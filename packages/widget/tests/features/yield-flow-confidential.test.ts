import { describe, expect, it } from "@effect/vitest";
import BigNumber from "bignumber.js";
import {
  Deferred,
  Effect,
  Exit,
  Layer,
  Option,
  Ref,
  Schema,
  Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import { Atom, AtomRegistry } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import {
  type DirectTransaction,
  DirectTransactionId,
} from "../../src/domain/action/direct-transaction";
import { ConfidentialHandle } from "../../src/domain/earn/models";
import {
  SignedTransactionPayload,
  WalletAddress,
  YieldId,
} from "../../src/domain/identity/identifiers";
import { Token } from "../../src/domain/token/token";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  getYieldFlowExitCompletion,
  getYieldFlowPlannedStepTypes,
  getYieldFlowWorkflowInput,
  makeYieldFlowSession,
  type NavigatingYieldTransactionFlowStart,
  type YieldFlowHandoff,
} from "../../src/features/yield-transaction-flow/model/yield-transaction-flow";
import { getYieldTransactionStepsView } from "../../src/features/yield-transaction-flow/model/yield-transaction-workflow";
import { startYieldFlowExecution } from "../../src/features/yield-transaction-flow/state/execution-page";
import { makeYieldFlowReviewPage } from "../../src/features/yield-transaction-flow/state/review-page";
import type { ActionPreviewRequest } from "../../src/services/api/operations";
import {
  LegacyResourceSource,
  YieldResourceSource,
} from "../../src/services/api/resource-sources";
import type { EvmRpc } from "../../src/services/evm-rpc/evm-rpc";
import type { TransactionWorkflowHandle } from "../../src/services/transaction-workflow/transaction-workflow-service";
import { WalletRequestCancelledError } from "../../src/services/wallet/wallet-errors";
import type { WalletState } from "../../src/services/wallet/wallet-state";
import type {
  WalletBroadcastResult,
  WalletSignedPayloadResult,
  WalletSignTransactionInput,
} from "../../src/services/wallet/wallet-transactions";
import type { ZamaService } from "../../src/services/zama/zama-service";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldApiActionFixture,
  yieldApiTransactionFixture,
} from "../fixtures";
import { makeConnectedWalletState } from "../fixtures/wallet-state";
import { makeYieldFlowTestKit } from "../utils/yield-flow-test-kit";

const { cUsdc, usdc } = confidentialFixture;
const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const signedPayload = {
  broadcasted: false,
  signedTx: SignedTransactionPayload.make("0x02aa"),
} as const;

const enterStart = (
  pick: "asset" | "underlying"
): NavigatingYieldTransactionFlowStart => {
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
        arguments: {
          amount: "5",
          ...(token.address === undefined ? {} : { inputToken: token.address }),
        },
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
): NavigatingYieldTransactionFlowStart => {
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
    mount: {
      _tag: "PositionExit",
      balanceId: "default",
      integrationId: Schema.decodeSync(YieldId)("i"),
    },
  };
};

const withdrawUnwrapStart = (): NavigatingYieldTransactionFlowStart => {
  const integration = confidentialYieldFixture();
  return {
    intake: {
      _tag: "Manage",
      balanceType: "withdrawable",
      confidentialHandle: Schema.decodeSync(ConfidentialHandle)(
        `0x${"ab".repeat(32)}`
      ),
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
    mount: {
      _tag: "PositionManage",
      balanceId: "default",
      integrationId: Schema.decodeSync(YieldId)("i"),
    },
  };
};

// Review's resources (prices, gas balances, KYC) run on the app runtime and
// never answer: a confidential vault's Confirm needs none of them.
const silentAppLayer = Layer.mergeAll(
  Reactivity.layer,
  Layer.succeed(
    LegacyResourceSource,
    LegacyResourceSource.of({
      getGasTokenBalances: () => Effect.never,
      getPrices: () => Effect.never,
    } as never)
  ),
  Layer.succeed(
    YieldResourceSource,
    YieldResourceSource.of({ getKycStatus: () => Effect.never } as never)
  )
);

const direct = (type: DirectTransaction["type"]): DirectTransaction => ({
  approval: null,
  chainId: 11155111,
  data: "0x00",
  id: DirectTransactionId.make(`conversion-${type.toLowerCase()}`),
  network: "ethereum",
  to: cUsdc.address as `0x${string}`,
  type,
});

const depositAction = yieldApiActionFixture({
  address,
  transactions: [
    yieldApiTransactionFixture({
      id: "deposit",
      network: "ethereum",
      status: "CREATED",
      stepIndex: 0,
      unsignedTransaction: "unsigned-deposit",
    }),
  ],
});

/**
 * One confidential Flow Session on the real workflow engine: Review's Confirm
 * through its page, then the Execution Steps would open for the handoff, each
 * in its own Scope as Steps' lifetime.
 */
const openConfidentialFlow = Effect.fn("test.openConfidentialFlow")(function* ({
  evmRpc = {},
  previewAction = () => Effect.succeed(depositAction),
  signTransaction = () => Effect.succeed(signedPayload),
  start,
  zama = {},
}: {
  readonly evmRpc?: Partial<EvmRpc["Service"]>;
  readonly previewAction?: (
    request: ActionPreviewRequest
  ) => Effect.Effect<typeof depositAction>;
  readonly signTransaction?: (
    input: WalletSignTransactionInput
  ) => Effect.Effect<
    WalletBroadcastResult | WalletSignedPayloadResult,
    WalletRequestCancelledError
  >;
  readonly start: NavigatingYieldTransactionFlowStart;
  readonly zama?: Partial<ZamaService["Service"]>;
}) {
  const walletState = yield* SubscriptionRef.make<WalletState>(
    makeConnectedWalletState(walletScope)
  );
  const previews: Array<ActionPreviewRequest> = [];
  const kit = yield* makeYieldFlowTestKit({
    engine: {
      evmRpc,
      yieldOperations: {
        getTransactionStatus: () =>
          Effect.succeed({ explorerUrl: null, status: "CONFIRMED" } as never),
        previewAction: (request) =>
          Effect.sync(() => previews.push(request)).pipe(
            Effect.andThen(previewAction(request))
          ),
        submitSignedTransaction: () =>
          Effect.succeed({
            explorerUrl: null,
            hash: null,
            status: "BROADCASTED",
          } as never),
      },
    },
    wallet: { signTransaction },
    walletState,
    zama: {
      countMissingOperatorGrants: () => Effect.succeed(0),
      decryptCommand: (preparation) => Effect.succeed(preparation.command),
      encryptCommand: (preparation) => Effect.succeed(preparation.command),
      ...zama,
    },
  });
  // Review and Execution share one set of services, as in the wallet runtime.
  const context = yield* Layer.build(kit.layer);
  const registry = AtomRegistry.make({
    initialValues: [
      Atom.initialValue(appRuntime.layer, silentAppLayer as never),
      Atom.initialValue(
        walletRuntime.layer,
        Layer.succeedContext(context) as never
      ),
    ],
  });
  yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
  const session = makeYieldFlowSession(start, walletScope);

  // Each Confirm is from a fresh arrival at Review.
  const confirm = Effect.gen(function* () {
    const page = makeYieldFlowReviewPage(session);
    registry.set(page.confirmAtom, undefined);
    const outcome = yield* AtomRegistry.getResult(registry, page.confirmAtom, {
      suspendOnWaiting: true,
    });
    const held = yield* Ref.get(session.handoff);
    if (outcome._tag !== "Confirmed" || held?._tag !== "Waiting") {
      return yield* Effect.die(outcome);
    }
    return held.handoff;
  });

  // Steps' Execution for `handoff`, until `close` as leaving Steps would.
  const startExecution = Effect.fnUntraced(function* (
    handoff: YieldFlowHandoff
  ) {
    const scope = yield* Scope.make();
    const execution = yield* startYieldFlowExecution(session, handoff).pipe(
      Scope.provide(scope),
      Effect.provideContext(context)
    );
    return { close: Scope.close(scope, Exit.void), execution } as const;
  });

  return { confirm, previews, startExecution } as const;
});

const preparationOf = (handoff: YieldFlowHandoff) =>
  handoff.source._tag === "Prepare" ? handoff.source.preparation : null;

const awaitState = (
  execution: TransactionWorkflowHandle,
  tag: "Completed" | "SignFailed"
) =>
  execution.states.pipe(
    Stream.filter((state) => state._tag === tag),
    Stream.runHead,
    Effect.map(Option.getOrThrow)
  );

const signedIds =
  (signed: Array<string>) => (input: WalletSignTransactionInput) =>
    Effect.sync(() => signed.push(input.txMeta.txId)).pipe(
      Effect.as(signedPayload)
    );

const convertingRpc: Partial<EvmRpc["Service"]> = {
  awaitOutcome: () => Effect.succeed("Confirmed"),
  broadcast: () => Effect.void,
  prepare: () => Effect.succeed("unsigned-direct"),
};

describe("confidential vault Yield Transaction Flow", () => {
  it("reports an instant exit in the underlying it pays out, and a private exit in the shares it queued", () => {
    const shareToken = Schema.decodeSync(Token)(confidentialFixture.cShare);
    const integration = confidentialYieldFixture({
      state: {
        pricePerShareState: {
          price: 1.25,
          quoteToken: usdc,
          shareToken: confidentialFixture.cShare,
        },
      },
    });
    const intake = (outputToken?: string) => {
      const start = exitStart(outputToken);
      if (start.intake._tag !== "Exit") throw new Error("not an exit");
      return {
        ...start.intake,
        integration,
        request: {
          ...start.intake.request,
          arguments: { ...start.intake.request.arguments, amount: "2" },
        },
        unstakeAmount: new BigNumber(2),
        unstakeToken: shareToken,
      };
    };
    const instant = getYieldFlowExitCompletion(intake(usdc.address));
    const queued = getYieldFlowExitCompletion(intake());

    expect(instant).toMatchObject({
      approximate: true,
      batched: false,
      token: { symbol: usdc.symbol },
    });
    expect(instant.amount.toFixed()).toBe("2.5");
    expect(queued).toMatchObject({
      approximate: false,
      batched: true,
      token: { symbol: confidentialFixture.cShare.symbol },
    });
    expect(queued.amount.toFixed()).toBe("2");
  });

  it("lists a private exit's operator grants before its redeem, and an instant exit's unwrap", () => {
    expect(
      getYieldFlowPlannedStepTypes(exitStart().intake, {
        missingOperatorGrants: 2,
      })
    ).toEqual(["SET_OPERATOR", "SET_OPERATOR", "REDEEM"]);
    expect(
      getYieldFlowPlannedStepTypes(exitStart().intake, {
        missingOperatorGrants: 0,
      })
    ).toEqual(["REDEEM"]);
    expect(
      getYieldFlowPlannedStepTypes(exitStart(usdc.address).intake, {
        missingOperatorGrants: 0,
      })
    ).toEqual(["UNWRAP", "DECRYPT", "WITHDRAW", "REDEEM"]);
  });

  it.effect(
    "finalizes an instant exit's unwrap in its own workflow, and leaves a private exit to its batch",
    () =>
      Effect.gen(function* () {
        const finalizeOf = (start: NavigatingYieldTransactionFlowStart) =>
          Effect.gen(function* () {
            const flow = yield* openConfidentialFlow({ start });
            const handoff = yield* flow.confirm;
            const input = getYieldFlowWorkflowInput({
              session: makeYieldFlowSession(start, walletScope),
              source: handoff.source,
            });
            return input._tag === "Confidential" ? input.finalizeUnwrap : null;
          });

        expect(yield* finalizeOf(exitStart(usdc.address))).toEqual({
          chainId: 11155111,
        });
        expect(yield* finalizeOf(exitStart())).toBeNull();
      })
  );

  it.effect(
    "plans a private exit's missing operator grants when the user confirms, so Steps lists them at once",
    () =>
      Effect.gen(function* () {
        const checked: Array<unknown> = [];
        const flow = yield* openConfidentialFlow({
          start: exitStart(),
          zama: {
            countMissingOperatorGrants: (input) =>
              Effect.sync(() => checked.push(input)).pipe(Effect.as(2)),
          },
        });

        const handoff = yield* flow.confirm;

        expect(checked).toEqual([
          {
            chainId: 11155111,
            operator: confidentialFixture.router,
            owner: address,
            tokens: [confidentialFixture.cShare.address],
          },
        ]);
        expect(
          handoff.source._tag === "Prepare" && handoff.source.plannedStepTypes
        ).toEqual(["SET_OPERATOR", "SET_OPERATOR", "REDEEM"]);
      })
  );

  it.effect(
    "hands Steps a cUSDC deposit's encryption, checked against its hidden balance",
    () =>
      Effect.gen(function* () {
        const flow = yield* openConfidentialFlow({
          start: enterStart("asset"),
        });

        const handoff = yield* flow.confirm;

        expect(preparationOf(handoff)).toMatchObject({
          _tag: "Encrypt",
          amount: 5_000_000n,
          assetAddress: cUsdc.address,
          balance: { chainId: 11155111, token: { address: cUsdc.address } },
          conversion: null,
          intent: "enter",
          requiresPermitSigner: true,
        });
        // A confidential vault's action is prepared on Steps, not previewed.
        expect(flow.previews).toEqual([]);
      })
  );

  it.effect("hands Steps the conversion of an underlying deposit", () =>
    Effect.gen(function* () {
      const flow = yield* openConfidentialFlow({
        start: enterStart("underlying"),
        zama: { planConversion: () => Effect.succeed([direct("WRAP")]) },
      });

      const handoff = yield* flow.confirm;

      expect(preparationOf(handoff)).toMatchObject({
        _tag: "Encrypt",
        balance: null,
        conversion: {
          chainId: 11155111,
          underlying: usdc.address,
          wrapper: cUsdc.address,
        },
      });
      expect(
        handoff.source._tag === "Prepare" && handoff.source.conversion
      ).toEqual([direct("WRAP")]);
    })
  );

  it.effect("hands Steps the encryption of an exit's shares", () =>
    Effect.gen(function* () {
      const flow = yield* openConfidentialFlow({ start: exitStart() });

      const handoff = yield* flow.confirm;

      expect(preparationOf(handoff)).toMatchObject({
        _tag: "Encrypt",
        amount: 7_000_000n,
        balance: null,
        conversion: null,
        instant: false,
        intent: "exit",
        requiresPermitSigner: false,
      });
    })
  );

  it.effect("hands Steps the public decryption of an unwrap withdrawal", () =>
    Effect.gen(function* () {
      const flow = yield* openConfidentialFlow({
        start: withdrawUnwrapStart(),
      });

      const handoff = yield* flow.confirm;

      expect(preparationOf(handoff)).toMatchObject({
        _tag: "Decrypt",
        chainId: 11155111,
        handle: `0x${"ab".repeat(32)}`,
        command: { action: "WITHDRAW", passthrough: "unwrap" },
      });
    })
  );
});

describe("confidential vault execution", () => {
  it.effect(
    "plans the conversion when the user confirms, so Steps lists it at once",
    () =>
      Effect.gen(function* () {
        const events: Array<string> = [];
        const flow = yield* openConfidentialFlow({
          start: enterStart("underlying"),
          zama: {
            encryptCommand: () => Effect.never,
            planConversion: () =>
              Effect.sync(() => events.push("plan")).pipe(
                Effect.as([
                  direct("RESET_APPROVAL"),
                  direct("APPROVAL"),
                  direct("WRAP"),
                ])
              ),
          },
        });

        const handoff = yield* flow.confirm;
        events.push("confirmed");
        const { close, execution } = yield* flow.startExecution(handoff);
        const preparing = yield* execution.states.pipe(
          Stream.runHead,
          Effect.map(Option.getOrThrow)
        );
        yield* close;

        expect(events).toEqual(["plan", "confirmed"]);
        expect(
          getYieldTransactionStepsView(preparing, {
            plannedStepTypes: ["DEPOSIT"],
            yieldId: confidentialYieldFixture().id,
          }).txStates.map(({ type }) => type)
        ).toEqual(["ENCRYPT", "RESET_APPROVAL", "APPROVAL", "WRAP", "DEPOSIT"]);
      })
  );

  it.effect(
    "previews the prepared request, then approves, wraps, and deposits",
    () =>
      Effect.gen(function* () {
        const signed: Array<string> = [];
        const planned: Array<unknown> = [];
        const flow = yield* openConfidentialFlow({
          evmRpc: convertingRpc,
          signTransaction: signedIds(signed),
          start: enterStart("underlying"),
          zama: {
            planConversion: (input) =>
              Effect.sync(() => planned.push(input)).pipe(
                Effect.as([direct("APPROVAL"), direct("WRAP")])
              ),
            encryptCommand: ({ command }) =>
              Effect.succeed({
                ...command,
                arguments: { encryptedAmount: "0xamount" },
              }),
          },
        });

        const { close, execution } = yield* flow.startExecution(
          yield* flow.confirm
        );
        yield* awaitState(execution, "Completed");
        yield* close;

        expect(planned).toEqual([
          {
            amount: 5_000_000n,
            conversion: {
              chainId: 11155111,
              underlying: usdc.address,
              wrapper: cUsdc.address,
            },
            network: confidentialYieldFixture().network,
            owner: address,
          },
        ]);
        expect(flow.previews.map(({ command }) => command.arguments)).toEqual([
          { encryptedAmount: "0xamount" },
        ]);
        expect(signed).toEqual([
          "conversion-approval",
          "conversion-wrap",
          "deposit",
        ]);
      })
  );

  it.effect(
    "neither re-reads the allowance nor wraps again when the user confirms after leaving Steps mid-wrap",
    () =>
      Effect.gen(function* () {
        const signed: Array<string> = [];
        const waiting = yield* Deferred.make<void>();
        let plans = 0;
        const flow = yield* openConfidentialFlow({
          evmRpc: {
            ...convertingRpc,
            // The first Steps is left while the wrap waits for its receipt.
            awaitOutcome: () =>
              Deferred.isDone(waiting).pipe(
                Effect.flatMap((resumed) =>
                  resumed
                    ? Effect.succeed("Confirmed" as const)
                    : Deferred.succeed(waiting, undefined).pipe(
                        Effect.andThen(Effect.never)
                      )
                )
              ),
          },
          signTransaction: signedIds(signed),
          start: enterStart("underlying"),
          zama: {
            planConversion: () =>
              Effect.sync(() => ++plans).pipe(Effect.as([direct("WRAP")])),
          },
        });

        const first = yield* flow.startExecution(yield* flow.confirm);
        yield* Deferred.await(waiting);
        yield* first.close;
        const second = yield* flow.startExecution(yield* flow.confirm);
        yield* awaitState(second.execution, "Completed");
        yield* second.close;

        expect(plans).toBe(1);
        expect(signed).toEqual(["conversion-wrap", "deposit"]);
      })
  );

  it.effect(
    "does not wrap again when the user confirms after the deposit was cancelled",
    () =>
      Effect.gen(function* () {
        const signed: Array<string> = [];
        const flow = yield* openConfidentialFlow({
          evmRpc: convertingRpc,
          signTransaction: (input) =>
            input.txMeta.txId === "deposit" &&
            !signed.includes("cancelled-deposit")
              ? Effect.sync(() => signed.push("cancelled-deposit")).pipe(
                  Effect.andThen(
                    Effect.fail(
                      new WalletRequestCancelledError({
                        operation: "transaction",
                      })
                    )
                  )
                )
              : signedIds(signed)(input),
          start: enterStart("underlying"),
          zama: { planConversion: () => Effect.succeed([direct("WRAP")]) },
        });

        const first = yield* flow.startExecution(yield* flow.confirm);
        yield* awaitState(first.execution, "SignFailed");
        yield* first.close;
        const second = yield* flow.startExecution(yield* flow.confirm);
        yield* awaitState(second.execution, "Completed");
        yield* second.close;

        expect(signed).toEqual([
          "conversion-wrap",
          "cancelled-deposit",
          "deposit",
        ]);
      })
  );
});
