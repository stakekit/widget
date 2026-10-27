import { Data, Duration, Effect, Result, Schedule } from "effect";
import { keccak256 } from "viem";
import type { ManageActionCommand } from "../../../domain/action/models";
import { getValidStakeSessionTx } from "../../../domain/action/rules";
import {
  type ActionPreviewRequest,
  isTransientApiFailure,
  YieldOperations,
} from "../../api/operations";
import {
  type ConfidentialPreparationError,
  ZamaService,
} from "../../zama/zama-service";
import {
  type ConfidentialTransactionWorkflowInput,
  flattenTransactionWorkflowTransactions,
  makeYieldTransactionWorkflowInput,
  TransactionPrepareError,
  type TransactionWorkflowContext,
} from "../transaction-workflow-model";
import {
  attachPreparedYieldAction,
  getTransactionWorkflowId,
  validateTransactionWorkflowInput,
} from "./model";

/** The API does not list the unwrap yet; its indexer runs once it confirms. */
class UnwrapNotListedError extends Data.TaggedError("UnwrapNotListedError") {}

// How long an unwrap may take to be listed, and to become decryptable.
const listingPoll = { interval: Duration.seconds(5), times: 23 } as const;
const decryptionPoll = { interval: Duration.seconds(5), times: 5 } as const;

/**
 * Creates a confidential workflow's action: its amount encrypted, or its
 * withdrawal decrypted, then previewed. The action's transactions join the
 * workflow only once the API accepted the prepared request. An instant exit
 * then finalizes the unwrap its action requested the same way.
 */
export const makePrepareAction = Effect.gen(function* () {
  const [yieldOperations, zama] = yield* Effect.all([
    YieldOperations,
    ZamaService,
  ]);

  const failFor = (context: TransactionWorkflowContext) => {
    const workflowId = getTransactionWorkflowId(context.domain);
    return (message: string, cause: unknown, retryable: boolean) =>
      new TransactionPrepareError({ cause, message, retryable, workflowId });
  };

  const attachPreview = Effect.fn("TransactionWorkflow.attachPreview")(
    function* ({
      context,
      input,
      request,
    }: {
      readonly context: TransactionWorkflowContext;
      readonly input: ConfidentialTransactionWorkflowInput;
      readonly request: ActionPreviewRequest;
    }) {
      const fail = failFor(context);
      const action = yield* yieldOperations
        .previewAction(request)
        .pipe(
          Effect.mapError((cause) =>
            fail(
              "The action preview failed.",
              cause,
              cause._tag !== "InputValidationError"
            )
          )
        );
      const validation = getValidStakeSessionTx(action);
      if (Result.isFailure(validation)) {
        return yield* fail(
          "The action preview is not executable.",
          validation.failure,
          false
        );
      }
      const prepared = makeYieldTransactionWorkflowInput({
        action: validation.success,
        inputToken: input.inputToken,
        providersDetails: input.providersDetails,
        walletScope: input.walletScope,
      });
      const inputError = validateTransactionWorkflowInput(prepared);
      if (inputError) return yield* fail(inputError.message, inputError, false);

      return attachPreparedYieldAction({ context, prepared });
    }
  );

  const prepareAction = Effect.fn("TransactionWorkflow.prepareAction")(
    function* ({
      context,
      input,
    }: {
      readonly context: TransactionWorkflowContext;
      readonly input: ConfidentialTransactionWorkflowInput;
    }) {
      const fail = failFor(context);
      const { preparation } = input;
      const prepareRequest: Effect.Effect<
        ActionPreviewRequest,
        ConfidentialPreparationError
      > =
        preparation._tag === "Decrypt"
          ? zama
              .decryptCommand(preparation)
              .pipe(Effect.map((command) => ({ command, intent: "manage" })))
          : zama.encryptCommand(preparation).pipe(
              Effect.map((command) => ({
                command,
                intent: preparation.intent,
              }))
            );
      const request = yield* prepareRequest.pipe(
        Effect.mapError((error) => fail(error.message, error, error.retryable))
      );
      return yield* attachPreview({ context, input, request });
    }
  );

  /**
   * Finalizes the unwrap an instant exit requested: waits for the API to list
   * it with its WITHDRAW, decrypts its amount, then previews that WITHDRAW.
   */
  const finalizeUnwrap = Effect.fn("TransactionWorkflow.finalizeUnwrap")(
    function* ({
      chainId,
      context,
      input,
    }: {
      readonly chainId: number;
      readonly context: TransactionWorkflowContext;
      readonly input: ConfidentialTransactionWorkflowInput;
    }) {
      const fail = failFor(context);
      const owner = input.walletScope.address;
      const unwrap = flattenTransactionWorkflowTransactions(context).find(
        ({ meta, source }) =>
          source._tag === "Yield" &&
          source.transaction.type === "UNWRAP" &&
          meta.done
      );
      const submission =
        unwrap?.meta.submissionIndex == null
          ? null
          : (context.submissions[unwrap.meta.submissionIndex] ?? null);
      // The API may not return the hash; a signed EVM transaction's keccak256
      // is its hash.
      const hash =
        submission?.hash ??
        (submission?.signedPayload
          ? keccak256(submission.signedPayload as `0x${string}`)
          : null);
      if (!hash) {
        return yield* fail("The unwrap transaction is unknown.", null, false);
      }
      const requestId = yield* zama
        .readUnwrapRequest({ chainId, hash, owner })
        .pipe(
          Effect.mapError((error) =>
            fail(error.message, error, error.retryable)
          )
        );

      const pendingAction = yield* yieldOperations
        .getYieldBalances({ address: owner, yieldId: input.yieldId })
        .pipe(
          Effect.flatMap((position) => {
            const listed = position.balances
              .filter(
                (balance) =>
                  balance.type === "withdrawable" &&
                  balance.shareAmountRaw?.toLowerCase() ===
                    requestId.toLowerCase()
              )
              .flatMap((balance) => balance.pendingActions)
              .find(({ type }) => type === "WITHDRAW");
            return listed
              ? Effect.succeed(listed)
              : Effect.fail(new UnwrapNotListedError());
          }),
          // A transient read failure is one more poll, not the end of it.
          Effect.retry({
            schedule: Schedule.spaced(listingPoll.interval),
            times: listingPoll.times,
            while: (error) =>
              error._tag === "UnwrapNotListedError" ||
              isTransientApiFailure(error),
          }),
          Effect.mapError((error) =>
            error._tag === "UnwrapNotListedError"
              ? fail("The unwrap is not listed yet.", error, true)
              : fail("The unwrap could not be read.", error, true)
          )
        );

      const command: ManageActionCommand = {
        action: "WITHDRAW",
        address: owner,
        arguments: {},
        passthrough: pendingAction.passthrough,
        yieldId: input.yieldId,
      };
      const decrypted = yield* zama
        .decryptCommand({
          _tag: "Decrypt",
          chainId,
          command,
          handle: requestId,
        })
        .pipe(
          // The amount becomes publicly decryptable shortly after the unwrap.
          Effect.retry({
            schedule: Schedule.spaced(decryptionPoll.interval),
            times: decryptionPoll.times,
            while: (error) => error.retryable,
          }),
          Effect.mapError((error) =>
            fail(error.message, error, error.retryable)
          )
        );
      return yield* attachPreview({
        context,
        input,
        request: { command: decrypted, intent: "manage" },
      });
    }
  );

  return { finalizeUnwrap, prepareAction } as const;
});
