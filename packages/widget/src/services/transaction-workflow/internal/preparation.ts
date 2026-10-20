import { Effect, Result } from "effect";
import { getValidStakeSessionTx } from "../../../domain/action/rules";
import {
  type ActionPreviewRequest,
  YieldOperations,
} from "../../api/operations";
import {
  type ConfidentialPreparationError,
  ZamaService,
} from "../../zama/zama-service";
import {
  type ConfidentialTransactionWorkflowInput,
  makeClassicTransactionWorkflowInput,
  TransactionPrepareError,
  type TransactionWorkflowContext,
} from "../transaction-workflow-model";
import {
  attachPreparedClassicAction,
  getTransactionWorkflowId,
  validateTransactionWorkflowInput,
} from "./model";

/**
 * Creates a confidential workflow's action: its amount encrypted, or its
 * withdrawal decrypted, then previewed. The action's transactions join the
 * workflow only once the API accepted the prepared request.
 */
export const makePrepareAction = Effect.gen(function* () {
  const [yieldOperations, zama] = yield* Effect.all([
    YieldOperations,
    ZamaService,
  ]);

  return Effect.fn("TransactionWorkflow.prepareAction")(function* ({
    context,
    input,
  }: {
    readonly context: TransactionWorkflowContext;
    readonly input: ConfidentialTransactionWorkflowInput;
  }) {
    const workflowId = getTransactionWorkflowId(context.domain);
    const fail = (message: string, cause: unknown, retryable: boolean) =>
      new TransactionPrepareError({ cause, message, retryable, workflowId });

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
    const prepared = makeClassicTransactionWorkflowInput({
      action: validation.success,
      inputToken: input.inputToken,
      providersDetails: input.providersDetails,
      walletScope: input.walletScope,
    });
    const inputError = validateTransactionWorkflowInput(prepared);
    if (inputError) return yield* fail(inputError.message, inputError, false);

    return attachPreparedClassicAction({ context, prepared });
  });
});
