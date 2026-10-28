import { describe, expect, it, vi } from "@effect/vitest";
import BigNumber from "bignumber.js";
import { DateTime, Effect, Layer, Option, Ref, Schema, Stream } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import { TokenBalance } from "../../../src/domain/finance/models";
import {
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  makeYieldActionContinuationSession,
  makeYieldFlowSession,
  YieldFlowHandoff,
  type YieldFlowSession,
  type YieldTransactionFlowIntake,
} from "../../../src/features/yield-transaction-flow/model/yield-transaction-flow";
import {
  makeYieldFlowReviewPage,
  YieldFlowReviewVisit,
  yieldFlowReviewPage,
} from "../../../src/features/yield-transaction-flow/state/review-page";
import type { YieldOperations } from "../../../src/services/api/operations";
import {
  ApiRequestError,
  InputValidationError,
  LegacyResourceSource,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { resourceInvalidationKeys } from "../../../src/services/resource-invalidation";
import {
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
  readonly getGasTokenBalances?: () => Effect.Effect<typeof gasBalances>;
  readonly previewAction?: YieldOperations["Service"]["previewAction"];
  readonly session: YieldFlowSession;
}>;

// Review's operations run on the wallet runtime (the kit's dependencies);
// its resources (prices, gas balances, KYC) run on the app runtime, whose
// sources never answer unless a case needs them.
const makeReviewHarness = Effect.fn("test.makeReviewHarness")(function* ({
  getGasTokenBalances = () => Effect.never,
  previewAction = () => Effect.never,
  session,
}: ReviewHarnessOptions) {
  const kit = yield* makeYieldFlowTestKit({
    initialWalletState: makeConnectedWalletState(walletScope),
    // Like the API, each run of a preview effect is one request.
    previewAction: (request) => Effect.suspend(() => previewAction(request)),
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
                  balanceId: "balance",
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
