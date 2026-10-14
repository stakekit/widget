import { Effect, Layer, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";
import { describe, expect, it } from "vitest";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { TokenBalancesResponse } from "../../../src/domain/finance/models";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { earnSelectionViewAtom } from "../../../src/features/earn/state/earn-selection";
import { earnYieldCatalogAtom } from "../../../src/features/earn/state/earn-selection/catalog/catalog";
import { YieldCatalogKey } from "../../../src/features/earn/state/earn-selection/catalog/keys";
import { earnEntryAtom } from "../../../src/features/earn/state/earn-selection/state/atoms";
import { earnEntryViewAtom } from "../../../src/features/earn/state/entry";
import { earnAppLoadingAtom } from "../../../src/features/earn/state/page-status";
import { earnYieldSelectionViewAtom } from "../../../src/features/earn/state/yield-selection";
import { walletConfigResultAtom } from "../../../src/features/wallet/index";
import {
  LegacyResourceSource,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { yieldApiYieldFixture } from "../../fixtures";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const stake = yieldApiYieldFixture();
const scope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x9999999999999999999999999999999999999999"
  ),
  network: "ethereum",
});
const balances = Schema.decodeSync(TokenBalancesResponse)([
  { amount: "5", availableYields: [stake.id], token: stake.token },
]);
// The yield catalog of the only token, revalidating over its loaded yield.
const revalidatingYieldCatalog = Atom.initialValue(
  earnYieldCatalogAtom(
    new YieldCatalogKey({
      category: null,
      network: stake.token.network,
      token: stake.token.address || stake.token.symbol,
      yieldIds: [stake.id],
    })
  ),
  AsyncResult.success([stake], { waiting: true })
);

const makeRegistry = (
  initialValues: ReadonlyArray<readonly [Atom.Atom<unknown>, unknown]> = []
) =>
  AtomRegistry.make({
    initialValues: [
      applicationRuntimeInitInitialValue(),
      Atom.initialValue(earnEntryAtom, {
        categoryOrder: ["stake", "defi", "rwa"],
        dashboardVariant: false,
        initParams: null,
        preferredTokenYieldsPerNetwork: null,
        walletResolution: "settled",
        walletScope: scope,
      }),
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          Reactivity.layer,
          Layer.succeed(LegacyResourceSource, {
            getTokenOptions: () =>
              Effect.succeed([
                { availableYields: [stake.id], token: stake.token },
              ]),
            scanTokenBalances: () => Effect.succeed(balances),
          } as never),
          Layer.succeed(YieldResourceSource, {
            getPositions: () => Effect.succeed({ errors: [], items: [] }),
            getProvider: () => Effect.succeedNone,
            listYields: () =>
              Effect.succeed({
                items: [stake],
                limit: 100,
                offset: 0,
                total: 1,
              }),
          } as never)
        ) as never
      ),
      ...initialValues,
    ],
  });

describe("Earn background refetch", () => {
  it("keeps the yield selection and footer loaded while yields revalidate", () => {
    const registry = makeRegistry([revalidatingYieldCatalog]);
    const unmountSelection = registry.mount(earnYieldSelectionViewAtom);
    const unmountEntry = registry.mount(earnEntryViewAtom);

    try {
      // Every source settles synchronously, so the selection is resolved.
      expect(registry.get(earnSelectionViewAtom).selection.yield?.id).toBe(
        stake.id
      );
      expect(registry.get(earnYieldSelectionViewAtom).isLoading).toBe(false);
      expect(registry.get(earnEntryViewAtom).footerIsLoading).toBe(false);
    } finally {
      unmountEntry();
      unmountSelection();
      registry.dispose();
    }
  });

  it("refreshes instead of app-loading while a loaded wallet config revalidates", () => {
    const registry = makeRegistry([
      Atom.initialValue(
        walletConfigResultAtom,
        AsyncResult.success({} as never, { waiting: true })
      ),
    ]);
    const unmount = registry.mount(earnEntryViewAtom);

    try {
      expect(
        registry.get(earnSelectionViewAtom).selection.token?.token.symbol
      ).toBe(stake.token.symbol);
      expect(registry.get(earnAppLoadingAtom).isLoading).toBe(false);
      expect(registry.get(earnEntryViewAtom)).toMatchObject({
        appLoading: false,
        // Submission still waits for the revalidated config.
        isFetching: true,
      });
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
