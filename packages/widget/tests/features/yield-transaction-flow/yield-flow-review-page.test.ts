import { describe, expect, it, vi } from "@effect/vitest";
import BigNumber from "bignumber.js";
import { DateTime, Effect, Layer, Option, Ref, Schema, Stream } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import {
  type DirectTransaction,
  DirectTransactionId,
} from "../../../src/domain/action/direct-transaction";
import { TokenBalance } from "../../../src/domain/finance/models";
import {
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import type { YieldTransactionFlowIntake } from "../../../src/features/yield-transaction-flow/model/intake";
import {
  makeYieldActionContinuationSession,
  makeYieldFlowSession,
  YieldFlowHandoff,
  type YieldFlowSession,
} from "../../../src/features/yield-transaction-flow/model/session";
import {
  makeYieldFlowReviewPage,
  YieldFlowReviewVisit,
  yieldFlowReviewPage,
} from "../../../src/features/yield-transaction-flow/state/review-page";
import type {
  ActionPreviewRequest,
  YieldOperations,
} from "../../../src/services/api/operations";
import {
  ApiRequestError,
  InputValidationError,
  LegacyResourceSource,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import type { EvmRpc } from "../../../src/services/evm-rpc/evm-rpc";
import { resourceInvalidationKeys } from "../../../src/services/resource-invalidation";
import { ConfidentialPreparationError } from "../../../src/services/zama/confidential-preparation";
import type { ZamaService } from "../../../src/services/zama/zama-service";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../../fixtures";
import { makeConnectedWalletState } from "../../fixtures/wallet-state";
import { makeYieldFlowTestKit } from "../../utils/yield-flow-test-kit";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const integrationId = Schema.decodeSync(YieldId)("integration");
const selectedStake = yieldApiYieldFixture();
const gasToken = selectedStake.mechanics.gasFeeToken;
const enterIntake: YieldTransactionFlowIntake = {
  _tag: "Enter",
  gasFeeToken: gasToken,
  providersDetails: [],
  request: { address, arguments: { amount: "1" }, yieldId: selectedStake.id },
  selectedProviderOption: null,
  selectedStake,
  selectedToken: selectedStake.token,
  selectedValidators: new Map(),
  walletScope,
};
const makeExitIntake = (
  integration = yieldApiYieldFixture()
): Extract<YieldTransactionFlowIntake, { readonly _tag: "Exit" }> => ({
  _tag: "Exit",
  gasFeeToken: integration.mechanics.gasFeeToken,
  integration,
  providersDetails: [],
  receiveToken: null,
  request: { address, arguments: { amount: "1" }, yieldId: integration.id },
  unstakeAmount: new BigNumber(1),
  unstakeToken: integration.token,
  walletScope,
});
const gasAction = yieldApiActionFixture({
  transactions: [
    yieldApiTransactionFixture({
      gasEstimate: JSON.stringify({ amount: "0.01", token: gasToken }),
    }),
  ],
});
const gasBalances = [
  Schema.decodeSync(TokenBalance)({
    amount: "5",
    availableYields: [],
    token: gasToken,
  }),
];

const reactivityAtom = appRuntime.atom(Reactivity.Reactivity);

const unavailablePreview = () =>
  Effect.fail(
    new ApiRequestError({
      cause: new Error("temporarily unavailable"),
      failure: { _tag: "Unreachable" },
      operation: "previewAction",
    })
  );

type ReviewHarnessOptions = Readonly<{
  readonly evmRpc?: Partial<EvmRpc["Service"]>;
  readonly getGasTokenBalances?: () => Effect.Effect<typeof gasBalances>;
  readonly previewAction?: YieldOperations["Service"]["previewAction"];
  readonly session: YieldFlowSession;
  readonly zama?: Partial<ZamaService["Service"]>;
}>;

// Review's operations run on the wallet runtime (the kit's dependencies);
// its resources (prices, gas balances, KYC) run on the app runtime, whose
// sources never answer unless a case needs them.
const makeReviewHarness = Effect.fn("test.makeReviewHarness")(function* ({
  evmRpc,
  getGasTokenBalances = () => Effect.never,
  previewAction = () => Effect.never,
  session,
  zama,
}: ReviewHarnessOptions) {
  const kit = yield* makeYieldFlowTestKit({
    ...(evmRpc ? { evmRpc } : {}),
    initialWalletState: makeConnectedWalletState(walletScope),
    // Like the API, each run of a preview effect is one request.
    previewAction: (request) => Effect.suspend(() => previewAction(request)),
    ...(zama ? { zama } : {}),
  });
  const registry = AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          Reactivity.layer,
          Layer.succeed(
            LegacyResourceSource,
            LegacyResourceSource.of({
              getGasTokenBalances,
              getPrices: () => Effect.never,
            } as never)
          ),
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({
              getKycStatus: () => Effect.never,
            } as never)
          )
        ) as never
      ),
      Atom.initialValue(walletRuntime.layer, kit.layer as never),
    ],
  });
  yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
  const handle = session;
  const page = makeYieldFlowReviewPage(handle);
  registry.mount(page.reviewViewAtom);
  registry.mount(page.activityReviewViewAtom);

  return {
    awaitView: <A>(
      atom: Atom.Atom<A>,
      predicate: (view: A) => boolean
    ): Effect.Effect<A> =>
      AtomRegistry.toStream(registry, atom).pipe(
        Stream.filter(predicate),
        Stream.runHead,
        Effect.map(Option.getOrThrow)
      ),
    confirm: Effect.suspend(() => {
      registry.set(page.confirmAtom, undefined);
      return AtomRegistry.getResult(registry, page.confirmAtom, {
        suspendOnWaiting: true,
      });
    }),
    handle,
    kit,
    page,
    registry,
  } as const;
});

describe("Yield flow Review page", () => {
  it.effect(
    "keeps the gas fee while a background balance refetch is in flight",
    () =>
      Effect.gen(function* () {
        let gasRequests = 0;
        const { awaitView, page, registry } = yield* makeReviewHarness({
          getGasTokenBalances: () => {
            gasRequests += 1;
            // The refetch never settles, so the review is observed while it
            // is in flight.
            return gasRequests === 1
              ? Effect.succeed(gasBalances)
              : Effect.never;
          },
          previewAction: () => Effect.succeed(gasAction),
          session: makeYieldFlowSession(
            { intake: enterIntake, mount: { _tag: "Earn" } },
            walletScope
          ),
        });
        registry.mount(reactivityAtom);

        const settled = yield* awaitView(
          page.reviewViewAtom,
          (view) => !view.gasCheckLoading
        );
        expect(settled.gasAmount?.toString()).toBe("0.01");

        const reactivity = AsyncResult.getOrThrow(registry.get(reactivityAtom));
        yield* reactivity.withBatch(
          reactivity.invalidate(
            resourceInvalidationKeys.walletBalances(walletScope)
          )
        );

        expect(gasRequests).toBe(2);
        expect(registry.get(page.reviewViewAtom)).toMatchObject({
          gasCheckLoading: false,
          isGasCheckWarning: false,
        });
      })
  );

  it.effect("rejects Confirm while the preview is still loading", () =>
    Effect.gen(function* () {
      const { confirm, handle, kit, page, registry } = yield* makeReviewHarness(
        {
          session: makeYieldFlowSession(
            { intake: enterIntake, mount: { _tag: "Earn" } },
            walletScope
          ),
        }
      );

      expect(registry.get(page.reviewViewAtom)).toMatchObject({
        actionPreviewLoading: true,
        confirmLoading: true,
      });
      expect(yield* confirm).toEqual({ _tag: "RejectedNotReady" });
      expect(yield* Ref.get(handle.handoff)).toBeNull();
      expect(yield* kit.navigation.commands).toEqual([]);
    })
  );

  it.effect(
    "holds the preview and rejects Confirm while KYC blocks the yield",
    () =>
      Effect.gen(function* () {
        const integration = {
          ...selectedStake,
          mechanics: {
            ...selectedStake.mechanics,
            requirements: { kycRequired: true },
          },
        };
        const previewAction = vi.fn<
          YieldOperations["Service"]["previewAction"]
        >(() => Effect.succeed(yieldApiActionFixture()));
        const { confirm, handle, kit, page, registry } =
          yield* makeReviewHarness({
            previewAction,
            session: makeYieldFlowSession(
              {
                intake: makeExitIntake(integration),
                mount: {
                  _tag: "PositionExit",
                  balanceId: "default",
                  integrationId,
                },
              },
              walletScope
            ),
          });

        expect(registry.get(page.reviewViewAtom)).toMatchObject({
          action: null,
          confirmDisabled: true,
          kyc: { isBlocking: true },
        });
        expect(yield* confirm).toEqual({ _tag: "RejectedBlocked" });
        expect(previewAction).not.toHaveBeenCalled();
        expect(yield* Ref.get(handle.handoff)).toBeNull();
        expect(yield* kit.navigation.commands).toEqual([]);
      })
  );

  it.effect(
    "charges an exit the yield's withdrawal fee on its amount, and no other flow",
    () =>
      Effect.gen(function* () {
        const integration = {
          ...selectedStake,
          mechanics: {
            ...selectedStake.mechanics,
            fee: {
              deposit: new BigNumber("1"),
              withdrawal: new BigNumber("0.5"),
            },
          },
        };
        const exit = yield* makeReviewHarness({
          session: makeYieldFlowSession(
            {
              intake: {
                ...makeExitIntake(integration),
                request: {
                  address,
                  arguments: { amount: "4" },
                  yieldId: integration.id,
                },
              },
              mount: {
                _tag: "PositionExit",
                balanceId: "default",
                integrationId,
              },
            },
            walletScope
          ),
        });
        const fee = exit.registry.get(exit.page.reviewViewAtom).withdrawalFee;
        expect(fee?.amount.toString()).toBe("0.02");
        expect(fee?.ratio.toString()).toBe("0.005");

        const enter = yield* makeReviewHarness({
          session: makeYieldFlowSession(
            {
              intake: { ...enterIntake, selectedStake: integration },
              mount: { _tag: "Earn" },
            },
            walletScope
          ),
        });
        expect(
          enter.registry.get(enter.page.reviewViewAtom).withdrawalFee
        ).toBeNull();
      })
  );

  it.effect(
    "retries a retryable preview failure on Confirm, then hands off once",
    () =>
      Effect.gen(function* () {
        const action = yieldApiActionFixture({ id: "retried-action" });
        let previewAttempts = 0;
        const { awaitView, confirm, handle, kit, page } =
          yield* makeReviewHarness({
            previewAction: () => {
              previewAttempts += 1;
              return previewAttempts === 1
                ? unavailablePreview()
                : Effect.succeed(action);
            },
            session: makeYieldFlowSession(
              { intake: enterIntake, mount: { _tag: "Earn" } },
              walletScope
            ),
          });

        const failed = yield* awaitView(
          page.reviewViewAtom,
          (view) => !view.actionPreviewLoading
        );
        expect(failed).toMatchObject({ action: null, confirmDisabled: false });

        expect(yield* confirm).toEqual({ _tag: "RetriedPreview" });
        expect(previewAttempts).toBe(2);
        expect(yield* Ref.get(handle.handoff)).toBeNull();

        yield* awaitView(page.reviewViewAtom, (view) => view.action !== null);
        expect(yield* confirm).toEqual({ _tag: "Confirmed" });
        const held = yield* Ref.get(handle.handoff);
        expect(held?._tag).toBe("Waiting");
        expect(held?.handoff.source).toEqual({ _tag: "Action", action });
        const handoff = held?.handoff;
        expect(yield* kit.navigation.commands).toEqual([
          {
            _tag: "Push",
            to: {
              path: "/steps",
              state: { executionHandoff: handoff, yieldFlowSession: handle },
            },
          },
        ]);

        expect(yield* confirm).toEqual({ _tag: "RejectedConfirmed" });
        expect(yield* Ref.get(handle.handoff)).toEqual({
          _tag: "Waiting",
          handoff,
        });
        expect((yield* Ref.get(handle.handoff))?.handoff).toBe(handoff);
        expect(yield* kit.navigation.commands).toHaveLength(1);
        expect(previewAttempts).toBe(2);
      })
  );

  it.effect(
    "releases an action no Steps took when Review is visited again",
    () =>
      Effect.gen(function* () {
        const action = yieldApiActionFixture({ id: "untaken-action" });
        const { awaitView, handle, kit, registry } = yield* makeReviewHarness({
          previewAction: () => Effect.succeed(action),
          session: makeYieldFlowSession(
            { intake: enterIntake, mount: { _tag: "Earn" } },
            walletScope
          ),
        });
        const confirmOnVisit = Effect.fnUntraced(function* (visit: string) {
          const pageAtom = yieldFlowReviewPage(
            new YieldFlowReviewVisit({ session: handle, visit })
          );
          registry.mount(pageAtom);
          const page = registry.get(pageAtom);
          registry.mount(page.reviewViewAtom);
          yield* awaitView(page.reviewViewAtom, (view) => view.action !== null);
          registry.set(page.confirmAtom, undefined);
          return yield* AtomRegistry.getResult(registry, page.confirmAtom, {
            suspendOnWaiting: true,
          });
        });

        expect(yield* confirmOnVisit("first")).toEqual({ _tag: "Confirmed" });
        // Steps never showed for that handoff; Review shows again.
        expect(yield* confirmOnVisit("second")).toEqual({ _tag: "Confirmed" });
        expect(yield* kit.navigation.commands).toHaveLength(2);
      })
  );

  it.effect(
    "keeps an action held while its Execution still runs as Review shows",
    () =>
      Effect.gen(function* () {
        const action = yieldApiActionFixture({ id: "continued-action" });
        const { awaitView, handle, kit, registry } = yield* makeReviewHarness({
          previewAction: () => Effect.succeed(action),
          session: makeYieldFlowSession(
            { intake: enterIntake, mount: { _tag: "Earn" } },
            walletScope
          ),
        });
        // Leaving Steps ends its Execution only once React drops its Atoms.
        const handoff = new YieldFlowHandoff({ _tag: "Action", action });
        yield* Ref.set(handle.handoff, { _tag: "Running", handoff } as const);
        const pageAtom = yieldFlowReviewPage(
          new YieldFlowReviewVisit({ session: handle, visit: "back" })
        );
        registry.mount(pageAtom);
        const page = registry.get(pageAtom);
        registry.mount(page.reviewViewAtom);
        yield* awaitView(page.reviewViewAtom, (view) => view.action !== null);

        registry.set(page.confirmAtom, undefined);
        const confirmation = yield* AtomRegistry.getResult(
          registry,
          page.confirmAtom,
          { suspendOnWaiting: true }
        );

        expect(confirmation).toEqual({ _tag: "RejectedConfirmed" });
        expect(yield* Ref.get(handle.handoff)).toEqual({
          _tag: "Running",
          handoff,
        });
        expect((yield* Ref.get(handle.handoff))?.handoff).toBe(handoff);
        expect(yield* kit.navigation.commands).toEqual([]);
      })
  );

  it.effect(
    "disables Confirm for an invalid preview request without retrying it",
    () =>
      Effect.gen(function* () {
        let previewAttempts = 0;
        const { awaitView, confirm, handle, kit, page } =
          yield* makeReviewHarness({
            previewAction: () => {
              previewAttempts += 1;
              return Effect.fail(
                new InputValidationError({
                  cause: new Error("invalid amount"),
                  issue: "amount must be a decimal string",
                  operation: "previewAction",
                })
              );
            },
            session: makeYieldFlowSession(
              { intake: enterIntake, mount: { _tag: "Earn" } },
              walletScope
            ),
          });

        const failed = yield* awaitView(
          page.reviewViewAtom,
          (view) => !view.actionPreviewLoading
        );
        expect(failed).toMatchObject({ action: null, confirmDisabled: true });
        expect(yield* confirm).toEqual({ _tag: "RejectedPreview" });
        expect(previewAttempts).toBe(1);
        expect(yield* Ref.get(handle.handoff)).toBeNull();
        expect(yield* kit.navigation.commands).toEqual([]);
      })
  );

  // Live: the presentation clock reads real time.
  it.live("hands off a continued Activity action while it is fresh", () =>
    Effect.gen(function* () {
      const action = yieldApiActionFixture({
        createdAt: yield* DateTime.now,
        status: "WAITING_FOR_NEXT",
      });
      const previewAction = vi.fn(() => Effect.die("unexpected preview"));
      const { awaitView, confirm, handle, kit, page } =
        yield* makeReviewHarness({
          previewAction,
          session: makeYieldActionContinuationSession({
            _tag: "YieldActionContinuation",
            action,
            providersDetails: [],
            selectedValidators: [],
            selectedYield: yieldApiYieldFixture(),
            walletScope,
          }),
        });

      yield* awaitView(
        page.activityReviewViewAtom,
        (view) => !view.confirmDisabled && !view.confirmLoading
      );
      expect(yield* confirm).toEqual({ _tag: "Confirmed" });
      expect(previewAction).not.toHaveBeenCalled();
      const held = yield* Ref.get(handle.handoff);
      expect(held?._tag).toBe("Waiting");
      expect(held?.handoff.source).toEqual({ _tag: "Action", action });
      expect(yield* kit.navigation.commands).toEqual([
        {
          _tag: "Push",
          to: {
            path: `/activity/${action.id}/steps`,
            state: {
              executionHandoff: held?.handoff,
              yieldFlowSession: handle,
            },
          },
        },
      ]);
    })
  );

  it.effect("rejects Confirm for an expired Activity action", () =>
    Effect.gen(function* () {
      const action = yieldApiActionFixture({
        createdAt: DateTime.makeUnsafe("2000-01-01T00:00:00.000Z"),
        status: "WAITING_FOR_NEXT",
      });
      const { confirm, handle, kit, page, registry } = yield* makeReviewHarness(
        {
          session: makeYieldActionContinuationSession({
            _tag: "YieldActionContinuation",
            action,
            providersDetails: [],
            selectedValidators: [],
            selectedYield: yieldApiYieldFixture(),
            walletScope,
          }),
        }
      );

      expect(registry.get(page.activityReviewViewAtom).confirmDisabled).toBe(
        true
      );
      expect(yield* confirm).toEqual({ _tag: "RejectedExpired" });
      expect(yield* Ref.get(handle.handoff)).toBeNull();
      expect(yield* kit.navigation.commands).toEqual([]);
    })
  );
});

describe("confidential vault Review", () => {
  const vault = confidentialYieldFixture();
  // The chain's native token, which pays an EVM transaction's fee.
  const { address: _gasTokenAddress, ...nativeGasToken } = gasToken;
  const ether = { ...nativeGasToken, decimals: 18 };
  const vaultAction = yieldApiActionFixture({
    address,
    id: "vault-action",
    transactions: [
      yieldApiTransactionFixture({
        gasEstimate: JSON.stringify({ amount: "0.01", token: ether }),
      }),
    ],
  });
  const enterVault = (
    pick: "asset" | "underlying",
    gasFeeToken: typeof gasToken = ether
  ) => {
    const token = pick === "asset" ? vault.inputTokens[0]! : vault.token;
    return makeYieldFlowSession(
      {
        intake: {
          _tag: "Enter",
          gasFeeToken,
          providersDetails: [],
          request: {
            address,
            arguments: {
              amount: "5",
              ...(token.address === undefined
                ? {}
                : { inputToken: token.address }),
            },
            yieldId: vault.id,
          },
          selectedProviderOption: null,
          selectedStake: vault,
          selectedToken: token,
          selectedValidators: new Map(),
          walletScope,
        },
        mount: { _tag: "Earn" },
      },
      walletScope
    );
  };
  const encrypted: Partial<ZamaService["Service"]> = {
    // Review never checks the hidden balance: revealing it may ask for a
    // permit, and the test Zama layer fails any reveal.
    checkConfidentialBalance: () =>
      Effect.die("Review must not check the hidden balance"),
    encryptCommand: ({ command }) =>
      Effect.succeed({
        ...command,
        arguments: { ...command.arguments, encryptedAmount: "0xamount" },
      }),
  };
  const direct = (type: DirectTransaction["type"]): DirectTransaction => ({
    approval: null,
    chainId: 11155111,
    data: "0x00",
    id: DirectTransactionId.make(`conversion-${type.toLowerCase()}`),
    network: "ethereum-sepolia",
    to: confidentialFixture.cUsdc.address,
    type,
  });

  it.effect(
    "shows a cUSDC deposit's API gas without a wallet prompt, and hands that action to Steps",
    () =>
      Effect.gen(function* () {
        const previews: Array<ActionPreviewRequest> = [];
        const { awaitView, confirm, handle, page } = yield* makeReviewHarness({
          previewAction: (request) =>
            Effect.sync(() => previews.push(request)).pipe(
              Effect.as(vaultAction)
            ),
          session: enterVault("asset"),
          zama: encrypted,
        });

        const view = yield* awaitView(
          page.reviewViewAtom,
          ({ gasAmount }) => gasAmount !== null
        );

        expect(view.gasAmount?.toFixed()).toBe("0.01");
        expect(previews).toEqual([
          {
            command: expect.objectContaining({
              arguments: expect.objectContaining({
                encryptedAmount: "0xamount",
              }),
            }),
            intent: "enter",
          },
        ]);
        expect(yield* confirm).toEqual({ _tag: "Confirmed" });
        const source = (yield* Ref.get(handle.handoff))?.handoff.source;
        expect(source?._tag === "Prepare" && source.prepared).toEqual(
          vaultAction
        );
        expect(previews).toHaveLength(1);
      })
  );

  it.effect(
    "adds the approve and wrap of an underlying deposit, assuming a wrap's gas until its approval lands",
    () =>
      Effect.gen(function* () {
        const estimated: Array<
          Parameters<EvmRpc["Service"]["estimateFee"]>[0]
        > = [];
        const { awaitView, page } = yield* makeReviewHarness({
          evmRpc: {
            estimateFee: (input) =>
              Effect.sync(() => estimated.push(input)).pipe(
                Effect.as(2_000_000_000_000_000n)
              ),
          },
          previewAction: () => Effect.succeed(vaultAction),
          session: enterVault("underlying"),
          zama: {
            ...encrypted,
            planConversion: () =>
              Effect.succeed([direct("APPROVAL"), direct("WRAP")]),
          },
        });

        const view = yield* awaitView(
          page.reviewViewAtom,
          ({ gasAmount }) => gasAmount !== null
        );

        expect(view.gasAmount?.toFixed()).toBe("0.012");
        expect(
          estimated.map(({ from, transactions }) => ({
            fallbackGas: transactions.map(({ fallbackGas }) => fallbackGas),
            from,
          }))
        ).toEqual([{ fallbackGas: [null, 400_000n], from: address }]);
      })
  );

  it.effect(
    "shows no gas rather than only the conversion's when the deposit has no estimate",
    () =>
      Effect.gen(function* () {
        const { awaitView, page } = yield* makeReviewHarness({
          evmRpc: {
            estimateFee: () => Effect.succeed(2_000_000_000_000_000n),
          },
          previewAction: () =>
            Effect.succeed({
              ...vaultAction,
              transactions: [yieldApiTransactionFixture()],
            }),
          session: enterVault("underlying"),
          zama: {
            ...encrypted,
            planConversion: () =>
              Effect.succeed([direct("APPROVAL"), direct("WRAP")]),
          },
        });

        const view = yield* awaitView(
          page.reviewViewAtom,
          ({ gasCheckLoading }) => !gasCheckLoading
        );

        expect(view.action).not.toBeNull();
        expect(view.gasAmount).toBeNull();
      })
  );

  it.effect(
    "shows no gas when the approve and wrap would be priced in a non-native gas token",
    () =>
      Effect.gen(function* () {
        const { awaitView, page } = yield* makeReviewHarness({
          evmRpc: {
            estimateFee: () => Effect.succeed(2_000_000_000_000_000n),
          },
          previewAction: () => Effect.succeed(vaultAction),
          session: enterVault("underlying", vault.token),
          zama: {
            ...encrypted,
            planConversion: () =>
              Effect.succeed([direct("APPROVAL"), direct("WRAP")]),
          },
        });

        const view = yield* awaitView(
          page.reviewViewAtom,
          ({ gasCheckLoading }) => !gasCheckLoading
        );

        expect(view.action).not.toBeNull();
        expect(view.gasAmount).toBeNull();
      })
  );

  it.effect(
    "shows the action's gas in a non-native gas token once no approve or wrap remains",
    () =>
      Effect.gen(function* () {
        const { awaitView, page } = yield* makeReviewHarness({
          previewAction: () => Effect.succeed(vaultAction),
          session: enterVault("underlying", vault.token),
          zama: { ...encrypted, planConversion: () => Effect.succeed([]) },
        });

        const view = yield* awaitView(
          page.reviewViewAtom,
          ({ gasAmount }) => gasAmount !== null
        );

        expect(view.gasAmount?.toFixed()).toBe("0.01");
      })
  );

  it.effect.each([
    ["a private withdrawal's API gas", {}, "0.01"],
    [
      "no gas for an instant withdrawal, whose finishing withdrawal Review cannot price",
      { outputToken: vault.token.address },
      null,
    ],
  ] as const)("shows %s", ([, outputArguments, expectedGas]) =>
    Effect.gen(function* () {
      const previews: Array<ActionPreviewRequest> = [];
      const { awaitView, page } = yield* makeReviewHarness({
        previewAction: (request) =>
          Effect.sync(() => previews.push(request)).pipe(
            Effect.as(vaultAction)
          ),
        session: makeYieldFlowSession(
          {
            intake: {
              ...makeExitIntake(vault),
              gasFeeToken: ether,
              request: {
                address,
                arguments: {
                  amount: "7",
                  shareAmountRaw: "7000000",
                  ...outputArguments,
                },
                yieldId: vault.id,
              },
            },
            mount: {
              _tag: "PositionExit",
              balanceId: "default",
              integrationId,
            },
          },
          walletScope
        ),
        zama: encrypted,
      });

      // A priced flow then checks the gas balance, which this harness never
      // answers; only an unpriced one settles the gas check.
      const view = yield* awaitView(page.reviewViewAtom, (candidate) =>
        expectedGas === null
          ? !candidate.gasCheckLoading
          : candidate.gasAmount !== null
      );

      expect(view.gasAmount?.toFixed() ?? null).toBe(expectedGas);
      expect(previews.map(({ intent }) => intent)).toEqual(["exit"]);
    })
  );

  it.effect(
    "shows no gas once preparing fails, and lets Steps prepare the action on Confirm",
    () =>
      Effect.gen(function* () {
        const { awaitView, confirm, handle, page } = yield* makeReviewHarness({
          previewAction: () => Effect.die("nothing to preview"),
          session: enterVault("asset"),
          zama: {
            ...encrypted,
            encryptCommand: () =>
              Effect.fail(
                new ConfidentialPreparationError({
                  cause: null,
                  message: "Zama encrypt failed.",
                  retryable: true,
                })
              ),
          },
        });

        const view = yield* awaitView(
          page.reviewViewAtom,
          ({ gasCheckLoading }) => !gasCheckLoading
        );

        expect(view).toMatchObject({
          action: null,
          confirmDisabled: false,
          gasAmount: null,
        });
        expect(yield* confirm).toEqual({ _tag: "Confirmed" });
        const source = (yield* Ref.get(handle.handoff))?.handoff.source;
        expect(source).toMatchObject({ _tag: "Prepare", prepared: null });
      })
  );
});
