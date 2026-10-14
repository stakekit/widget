import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { TokenBalance } from "../../../src/domain/finance/models";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import type { ClassicTransactionFlowIntake } from "../../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { makeClassicFlowSessionReviewResources } from "../../../src/features/classic-transaction-flow/state/atoms/classic-flow-review-view";
import type { CurrentYieldKycGate } from "../../../src/features/yield-summary/index";
import { LegacyResourceSource } from "../../../src/services/api/resource-sources";
import { resourceInvalidationKeys } from "../../../src/services/resource-invalidation";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const selectedStake = yieldApiYieldFixture();
const gasToken = selectedStake.mechanics.gasFeeToken;
const intake: ClassicTransactionFlowIntake = {
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
const action = yieldApiActionFixture({
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
// The review only reads these two flags of the KYC gate.
const kycGate = {
  isBlocking: false,
  isLoading: false,
} as unknown as CurrentYieldKycGate;

const reactivityAtom = appRuntime.atom(Reactivity.Reactivity);

describe("Classic flow review", () => {
  it.effect(
    "keeps the gas fee while a background balance refetch is in flight",
    () =>
      Effect.gen(function* () {
        let gasRequests = 0;
        const registry = AtomRegistry.make({
          initialValues: [
            Atom.initialValue(
              appRuntime.layer,
              Layer.mergeAll(
                Reactivity.layer,
                Layer.succeed(
                  LegacyResourceSource,
                  LegacyResourceSource.of({
                    getGasTokenBalances: () => {
                      gasRequests += 1;
                      // The refetch never settles, so the review is observed
                      // while it is in flight.
                      return gasRequests === 1
                        ? Effect.succeed(gasBalances)
                        : Effect.never;
                    },
                    getPrices: () => Effect.never,
                  } as never)
                )
              ) as never
            ),
          ],
        });
        const { reviewViewAtom } = makeClassicFlowSessionReviewResources({
          actionPreviewAtom: Atom.make(AsyncResult.success(action)),
          activityExpiredAtom: Atom.make(false),
          intakeAtom: Atom.make(intake),
          kycGateAtom: Atom.make(kycGate),
        });
        yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
        registry.mount(reviewViewAtom);
        registry.mount(reactivityAtom);

        // The first balance read settles synchronously.
        expect(registry.get(reviewViewAtom).gasCheckLoading).toBe(false);

        const reactivity = AsyncResult.getOrThrow(registry.get(reactivityAtom));
        yield* reactivity.withBatch(
          reactivity.invalidate(
            resourceInvalidationKeys.walletBalances(walletScope)
          )
        );

        expect(gasRequests).toBe(2);
        expect(registry.get(reviewViewAtom).gasCheckLoading).toBe(false);
      })
  );
});
