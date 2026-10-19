import { describe, expect, it } from "@effect/vitest";
import BigNumber from "bignumber.js";
import {
  Deferred,
  Effect,
  Queue,
  Schema,
  type Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import type { YieldAction } from "../../src/domain/action/models";
import {
  type ConfidentialEncryption,
  confidentialTokenBalanceKey,
} from "../../src/domain/earn/confidential";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import type { NavigatingClassicTransactionFlowStart } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import type { ClassicFlowConversion } from "../../src/features/classic-transaction-flow/model/classic-transaction-workflow";
import type { ClassicFlowExecutionHandle } from "../../src/features/classic-transaction-flow/state/orchestration/classic-flow-execution";
import type { ClassicFlowSessionHandle } from "../../src/features/classic-transaction-flow/state/orchestration/classic-flow-session";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import type { ActionPreviewRequest } from "../../src/services/api/operations";
import { InputValidationError } from "../../src/services/api/resource-sources";
import { TransactionWorkflowInputError } from "../../src/services/transaction-workflow/transaction-workflow-model";
import type { WalletState } from "../../src/services/wallet/wallet-state";
import { ConfidentialValues } from "../../src/services/zama/confidential-values";
import type { ZamaService } from "../../src/services/zama/zama-service";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldApiActionFixture,
} from "../fixtures";
import { makeConnectedWalletState } from "../fixtures/wallet-state";
import { makeClassicFlowTestKit } from "../utils/classic-flow-test-kit";

const { cUsdc, router, usdc } = confidentialFixture;
const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const readyEligibility = Stream.succeed({
  activityExpired: false,
  kycBlocking: false,
});
const encryption: ConfidentialEncryption = {
  amount: { handle: "0xamount", proof: "0xamountproof" },
  legs: { handles: ["0xleg0", "0xleg1"], proof: "0xlegproof" },
};

const enterStart = (
  pick: "asset" | "underlying"
): NavigatingClassicTransactionFlowStart => {
  const selectedStake = confidentialYieldFixture();
  const token =
    pick === "asset" ? selectedStake.inputTokens[0]! : selectedStake.token;
  return {
    intake: {
      _tag: "Enter",
      gasFeeToken: selectedStake.mechanics.gasFeeToken,
      providersDetails: [],
      request: {
        address,
        arguments: { amount: "5", inputToken: token.address },
        yieldId: selectedStake.id,
      },
      selectedProviderOption: null,
      selectedStake,
      selectedToken: token,
      selectedValidators: new Map(),
      walletScope,
    },
    mount: { _tag: "Earn" },
  };
};

const exitStart = (
  outputToken?: string
): NavigatingClassicTransactionFlowStart => {
  const integration = confidentialYieldFixture();
  return {
    intake: {
      _tag: "Exit",
      gasFeeToken: integration.mechanics.gasFeeToken,
      integration,
      providersDetails: [],
      receiveToken: null,
      request: {
        address,
        arguments: {
          amount: "7",
          shareAmountRaw: "7000000",
          ...(outputToken ? { outputToken } : {}),
        },
        yieldId: integration.id,
      },
      unstakeAmount: new BigNumber(7),
      unstakeToken: integration.token,
      walletScope,
    },
    mount: { _tag: "PositionExit", balanceId: "b", integrationId: "i" },
  };
};

const withdrawUnwrapStart = (): NavigatingClassicTransactionFlowStart => {
  const integration = confidentialYieldFixture();
  return {
    intake: {
      _tag: "Manage",
      balanceType: "withdrawable",
      confidentialHandle: "0xrequest",
      gasFeeToken: integration.mechanics.gasFeeToken,
      integration,
      interactedToken: integration.token,
      pendingActionType: "WITHDRAW",
      providersDetails: [],
      request: {
        action: "WITHDRAW",
        address,
        passthrough: "unwrap",
        yieldId: integration.id,
      },
      walletScope,
    },
    mount: { _tag: "PositionManage", balanceId: "b", integrationId: "i" },
  };
};

const runReview = ({
  confirm,
  previewAction,
  retryFailedConversion = false,
  retryRejectedConversion = false,
  start,
  zama,
}: {
  readonly confirm: boolean;
  readonly previewAction?: (
    request: ActionPreviewRequest
  ) => Effect.Effect<YieldAction, InputValidationError>;
  readonly retryFailedConversion?: boolean;
  readonly retryRejectedConversion?: boolean;
  readonly start: NavigatingClassicTransactionFlowStart;
  readonly zama: Partial<ZamaService["Service"]>;
}) =>
  Effect.gen(function* () {
    const events: Array<string> = [];
    const requests: Array<ActionPreviewRequest> = [];
    const workflowStarted = yield* Deferred.make<void>();
    const walletState = yield* SubscriptionRef.make<WalletState>(
      makeConnectedWalletState(walletScope)
    );
    const kit = yield* makeClassicFlowTestKit({
      makeWorkflow: () =>
        Effect.sync(() => events.push("workflow")).pipe(
          Effect.andThen(Deferred.succeed(workflowStarted, undefined)),
          Effect.as({ dispatch: () => Effect.void, states: Stream.never })
        ),
      previewAction: (request) =>
        Effect.sync(() => {
          events.push("preview");
          requests.push(request);
        }).pipe(
          Effect.andThen(
            previewAction?.(request) ?? Effect.succeed(yieldApiActionFixture())
          )
        ),
      walletState,
      zama: {
        ...zama,
        convertStep: (input) =>
          Effect.sync(() => events.push(input.step)).pipe(
            Effect.andThen(input.onBroadcast),
            Effect.andThen(zama.convertStep?.(input) ?? Effect.succeed(0))
          ),
      },
    });

    yield* Effect.scoped(
      Effect.gen(function* () {
        const service = yield* ClassicTransactionFlowService;
        const started = yield* service.start(start);
        if (started._tag !== "Started") return yield* Effect.die(started);
        const session = yield* service.openSession(started.session);
        const review = yield* session.acquireReview(readyEligibility);
        yield* review.states.pipe(
          Stream.filter((state) => state.preview._tag === "Success"),
          Stream.runHead
        );
        if (!confirm) return;

        yield* review.confirm();
        events.push("confirmed");
        const outcome = yield* session.acquireExecution();
        if (outcome._tag !== "Acquired") return yield* Effect.die(outcome);
        if (retryRejectedConversion) {
          yield* outcome.execution.conversion.pipe(
            Stream.filter(
              (conversion) =>
                conversion?.steps.some((step) => step.status === "rejected") ??
                false
            ),
            Stream.runHead
          );
          events.push("retry");
          yield* outcome.execution.runWorkflow({ _tag: "Retry" });
          yield* Effect.yieldNow;
          yield* Effect.yieldNow;
          return;
        }
        if (retryFailedConversion) {
          yield* outcome.execution.conversion.pipe(
            Stream.filter(
              (conversion) =>
                conversion?.steps.some((step) => step.status === "failed") ??
                false
            ),
            Stream.runHead
          );
          events.push("retry");
          yield* outcome.execution.runWorkflow({ _tag: "Retry" });
        }
        yield* Deferred.await(workflowStarted);
      })
    ).pipe(Effect.provide(kit.layer));

    return { events, requests };
  });

describe("confidential vault Classic Transaction Flow", () => {
  it.effect(
    "previews a cUSDC deposit with encrypted inputs instead of the amount",
    () =>
      Effect.gen(function* () {
        const plans: Array<unknown> = [];
        const { events, requests } = yield* runReview({
          confirm: true,
          start: enterStart("asset"),
          zama: {
            revealTokenBalance: () => Effect.succeed(5_000_000n),
            encrypt: ({ plan }) =>
              Effect.sync(() => {
                plans.push(plan);
                return encryption;
              }),
          },
        });

        expect(plans).toEqual([
          {
            amount: { contract: cUsdc.address, value: 5_000_000n },
            chainId: 11155111,
            legs: { contract: router, values: [0n, 5_000_000n] },
          },
        ]);
        expect(requests[0]?.command.arguments).toEqual({
          encryptedAmount: "0xamount",
          encryptedAmountProof: "0xamountproof",
          encryptedLegAmounts: ["0xleg0", "0xleg1"],
          encryptedLegProof: "0xlegproof",
          inputToken: cUsdc.address,
        });
        // cUSDC needs no conversion: the deposit starts straight after confirm.
        expect(events).toEqual(["confirmed", "preview", "workflow"]);
      })
  );

  it.effect(
    "runs approve and wrap as steps after confirm, then starts the deposit",
    () =>
      Effect.gen(function* () {
        const plans: Array<{
          readonly legs: { readonly values: unknown } | null;
        }> = [];
        const planned: Array<unknown> = [];
        const { events } = yield* runReview({
          confirm: true,
          start: enterStart("underlying"),
          zama: {
            conversionSteps: ({ amount, conversion }) =>
              Effect.sync(() => {
                planned.push({ amount, conversion });
                return ["approve", "wrap"] as const;
              }),
            encrypt: ({ plan }) =>
              Effect.sync(() => {
                plans.push(plan);
                return encryption;
              }),
            wrappedAmount: ({ amount }) => Effect.succeed(amount / 2n),
          },
        });

        expect(plans[0]?.legs?.values).toEqual([0n, 2_500_000n]);
        expect(planned).toEqual([
          {
            amount: 5_000_000n,
            conversion: {
              chainId: 11155111,
              underlying: usdc.address,
              wrapper: cUsdc.address,
            },
          },
        ]);
        expect(events).toEqual([
          "confirmed",
          "preview",
          "approve",
          "wrap",
          "workflow",
        ]);
      })
  );

  it.effect(
    "retries only the failed conversion step before starting the deposit",
    () =>
      Effect.gen(function* () {
        let wrapAttempts = 0;
        const { events } = yield* runReview({
          confirm: true,
          retryFailedConversion: true,
          start: enterStart("underlying"),
          zama: {
            conversionSteps: () => Effect.succeed(["approve", "wrap"] as const),
            convertStep: ({ step }) =>
              step === "wrap" && wrapAttempts++ === 0
                ? Effect.fail({ _tag: "ZamaError" } as never)
                : Effect.succeed(0),
            encrypt: () => Effect.succeed(encryption),
            wrappedAmount: ({ amount }) => Effect.succeed(amount),
          },
        });

        expect(events).toEqual([
          "confirmed",
          "preview",
          "approve",
          "wrap",
          "retry",
          "wrap",
          "workflow",
        ]);
      })
  );

  it.effect(
    "does not retry an action the API rejected as invalid after encryption",
    () =>
      Effect.gen(function* () {
        const { events } = yield* runReview({
          confirm: true,
          previewAction: () =>
            Effect.fail(
              new InputValidationError({
                cause: null,
                issue: "invalid encrypted amount",
                operation: "preview-action",
              })
            ),
          retryRejectedConversion: true,
          start: enterStart("asset"),
          zama: {
            encrypt: () => Effect.succeed(encryption),
            revealTokenBalance: () => Effect.succeed(5_000_000n),
          },
        });

        expect(events).toEqual(["confirmed", "preview", "retry"]);
      })
  );

  it.effect("exits with encrypted share legs and no plain amounts", () =>
    Effect.gen(function* () {
      const plans: Array<unknown> = [];
      const { requests } = yield* runReview({
        confirm: true,
        start: exitStart(),
        zama: {
          encrypt: ({ plan }) =>
            Effect.sync(() => {
              plans.push(plan);
              return { ...encryption, amount: null };
            }),
        },
      });

      expect(plans).toEqual([
        {
          amount: null,
          chainId: 11155111,
          legs: { contract: router, values: [0n, 7_000_000n] },
        },
      ]);
      expect(requests[0]).toMatchObject({ intent: "exit" });
      expect(requests[0]?.command.arguments).toEqual({
        encryptedLegAmounts: ["0xleg0", "0xleg1"],
        encryptedLegProof: "0xlegproof",
      });
    })
  );

  it.effect(
    "publicly decrypts the unwrap after confirm and withdraws with the proof",
    () =>
      Effect.gen(function* () {
        const decrypted: Array<unknown> = [];
        const { events, requests } = yield* runReview({
          confirm: true,
          start: withdrawUnwrapStart(),
          zama: {
            publicDecrypt: (input) =>
              Effect.sync(() => {
                decrypted.push(input);
                return { cleartext: 7_000_000n, decryptionProof: "0xproof" };
              }),
          },
        });

        expect(events).toEqual(["confirmed", "preview", "workflow"]);
        expect(decrypted).toEqual([
          { chainId: 11155111, owner: address, requestId: "0xrequest" },
        ]);
        expect(requests[0]?.command.arguments).toMatchObject({
          decryptedAmount: "7000000",
          decryptionProof: "0xproof",
        });
      })
  );

  it.effect(
    "rejects a cUSDC deposit above the decrypted balance before encrypting",
    () =>
      Effect.gen(function* () {
        const { events, requests } = yield* runReview({
          confirm: true,
          retryRejectedConversion: true,
          start: enterStart("asset"),
          zama: {
            encrypt: () => Effect.die("encrypted an over-balance deposit"),
            revealTokenBalance: () => Effect.succeed(4_999_999n),
          },
        });

        expect(requests).toEqual([]);
        expect(events).toEqual(["confirmed", "retry"]);
      })
  );
});

const workflowFixture = {
  dispatch: () => Effect.void,
  states: Stream.never,
};

const convertingZama = (
  events: Array<string>,
  convertStep: ZamaService["Service"]["convertStep"] = () => Effect.succeed(0)
): Partial<ZamaService["Service"]> => ({
  conversionSteps: () => Effect.succeed(["approve", "wrap"] as const),
  convertStep: (input) =>
    Effect.sync(() => events.push(input.step)).pipe(
      Effect.andThen(input.onBroadcast),
      Effect.andThen(convertStep(input))
    ),
  encrypt: () => Effect.succeed(encryption),
  wrappedAmount: ({ amount }) => Effect.succeed(amount),
});

const withSession = <A, E>(
  options: Pick<
    Parameters<typeof makeClassicFlowTestKit>[0],
    "makeWorkflow" | "previewAction" | "zama"
  >,
  use: (
    session: ClassicFlowSessionHandle
  ) => Effect.Effect<
    A,
    E,
    ClassicTransactionFlowService | ConfidentialValues | Scope.Scope
  >
) =>
  Effect.gen(function* () {
    const walletState = yield* SubscriptionRef.make<WalletState>(
      makeConnectedWalletState(walletScope)
    );
    const kit = yield* makeClassicFlowTestKit({ ...options, walletState });
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const service = yield* ClassicTransactionFlowService;
        const started = yield* service.start(enterStart("underlying"));
        if (started._tag !== "Started") return yield* Effect.die(started);
        return yield* use(yield* service.openSession(started.session));
      })
    ).pipe(Effect.provide(kit.layer));
  });

const confirmExecution = (session: ClassicFlowSessionHandle) =>
  Effect.gen(function* () {
    const review = yield* session.acquireReview(readyEligibility);
    yield* review.states.pipe(
      Stream.filter((state) => state.preview._tag === "Success"),
      Stream.runHead
    );
    yield* review.confirm();
    const outcome = yield* session.acquireExecution();
    if (outcome._tag !== "Acquired") return yield* Effect.die(outcome);
    return outcome.execution;
  });

const awaitConversion = (
  execution: ClassicFlowExecutionHandle,
  predicate: (conversion: ClassicFlowConversion) => boolean
) =>
  execution.conversion.pipe(
    Stream.filter((conversion) => conversion !== null && predicate(conversion)),
    Stream.runHead
  );

describe("confidential vault execution", () => {
  it.effect("does not wrap again when the user confirms a second time", () =>
    Effect.gen(function* () {
      const events: Array<string> = [];
      const workflows = yield* Queue.unbounded<void>();
      yield* withSession(
        {
          makeWorkflow: () =>
            Queue.offer(workflows, undefined).pipe(Effect.as(workflowFixture)),
          previewAction: () => Effect.succeed(yieldApiActionFixture()),
          zama: convertingZama(events),
        },
        (session) =>
          Effect.gen(function* () {
            yield* confirmExecution(session);
            yield* Queue.take(workflows);
            events.push("back");
            yield* confirmExecution(session);
            yield* Queue.take(workflows);
          })
      );

      expect(events).toEqual(["approve", "wrap", "back"]);
    })
  );

  it.effect(
    "surfaces a workflow setup error raised after the conversion steps",
    () =>
      Effect.gen(function* () {
        const error = yield* withSession(
          {
            makeWorkflow: () =>
              Effect.fail(
                new TransactionWorkflowInputError({
                  message: "bad input",
                  workflowId: "w",
                })
              ),
            previewAction: () => Effect.succeed(yieldApiActionFixture()),
            zama: convertingZama([]),
          },
          (session) =>
            confirmExecution(session).pipe(
              Effect.flatMap((execution) =>
                execution.states.pipe(Stream.runHead, Effect.flip)
              )
            )
        );

        expect(error).toMatchObject({ message: "bad input" });
      })
  );

  it.effect("forgets the revealed cUSDC balance once the wrap lands", () =>
    Effect.gen(function* () {
      const key = confidentialTokenBalanceKey({
        owner: address,
        token: confidentialYieldFixture().inputTokens[0]!,
      });
      const remaining = yield* withSession(
        {
          makeWorkflow: () => Effect.succeed(workflowFixture),
          previewAction: () => Effect.succeed(yieldApiActionFixture()),
          zama: convertingZama([]),
        },
        (session) =>
          Effect.gen(function* () {
            const values = yield* ConfidentialValues;
            yield* values.add([[key, 1n]]);
            const execution = yield* confirmExecution(session);
            yield* awaitConversion(execution, (conversion) =>
              conversion.steps.every((step) => step.status === "done")
            );
            return yield* values.current;
          })
      );

      expect(remaining.has(key)).toBe(false);
    })
  );
});
