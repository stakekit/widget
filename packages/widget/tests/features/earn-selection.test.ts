import { Effect, Layer, Schema } from "effect";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { TokenBalancesResponse } from "../../src/domain/finance/models";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { tokenString } from "../../src/domain/token/token";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  earnSelectionStatusViewAtom,
  earnSelectionTokenOptionsViewAtom,
  earnSelectionViewAtom,
  selectEarnSelectionTokenAtom,
  setEarnSelectionAmountAtom,
} from "../../src/features/earn/state/earn-selection";
import { earnEntryAtom } from "../../src/features/earn/state/earn-selection/state/atoms";
import type { EarnEntry } from "../../src/features/earn/state/earn-selection/types";
import {
  ApiRequestError,
  LegacyResourceSource,
  YieldResourceSource,
} from "../../src/services/api/resource-sources";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../fixtures";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";

const firstYield = yieldApiYieldFixture();
const secondYield = yieldApiYieldFixture({
  id: "ethereum-usdc-lending",
  token: {
    ...firstYield.token,
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    name: "USD Coin",
    symbol: "USDC",
  },
});
const scope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x9999999999999999999999999999999999999999"
  ),
  network: "ethereum",
});
const classicEntry: EarnEntry = {
  categoryOrder: ["stake", "defi", "rwa"],
  dashboardVariant: false,
  initParams: null,
  preferredTokenYieldsPerNetwork: null,
  walletResolution: "settled",
  walletScope: scope,
};

const tokenCatalog = [firstYield, secondYield].map((yieldModel) => ({
  availableYields: [yieldModel.id],
  token: yieldModel.token,
}));

const makeRegistry = ({
  entry = classicEntry,
  listYields = () =>
    Effect.succeed({
      items: [firstYield, secondYield],
      limit: 100,
      offset: 0,
      total: 2,
    }),
  scanTokenBalances,
  tokenOptions = tokenCatalog,
}: {
  readonly entry?: EarnEntry;
  readonly listYields?: YieldResourceSource["Service"]["listYields"];
  readonly scanTokenBalances: LegacyResourceSource["Service"]["scanTokenBalances"];
  readonly tokenOptions?: typeof tokenCatalog;
}) => {
  const getTokenOptions = vi.fn(() => Effect.succeed(tokenOptions));
  const registry = AtomRegistry.make({
    initialValues: [
      applicationRuntimeInitInitialValue(),
      Atom.initialValue(earnEntryAtom, entry),
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          Reactivity.layer,
          Layer.succeed(
            LegacyResourceSource,
            LegacyResourceSource.of({
              getTokenOptions,
              scanTokenBalances,
            } as never)
          ),
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({
              getPositions: () => Effect.succeed({ errors: [], items: [] }),
              getProvider: () => Effect.succeedNone,
              listYields,
            } as never)
          )
        ) as never
      ),
    ],
  });
  return { getTokenOptions, registry };
};

describe("Earn Selection", () => {
  it("waits for the first balance attempt before choosing the initial token", async () => {
    const balanceResult = Schema.decodeSync(TokenBalancesResponse)([
      {
        amount: "5",
        availableYields: [secondYield.id],
        token: secondYield.token,
      },
    ]);
    const { registry } = makeRegistry({
      scanTokenBalances: () =>
        Effect.sleep("100 millis").pipe(Effect.as(balanceResult)),
    });
    const unmount = registry.mount(earnSelectionViewAtom);

    try {
      expect(registry.get(earnSelectionViewAtom).selection.token).toBeNull();

      await vi.waitFor(() =>
        expect(
          registry.get(earnSelectionViewAtom).selection.token?.token.symbol
        ).toBe("USDC")
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("keeps browsing available with unknown amounts after balance failure", async () => {
    const { getTokenOptions, registry } = makeRegistry({
      scanTokenBalances: () =>
        Effect.fail(
          new ApiRequestError({
            cause: new Error("offline"),
            operation: "token-balances-scan",
          })
        ),
    });
    const unmount = registry.mount(earnSelectionViewAtom);

    try {
      await vi.waitFor(() =>
        expect(
          registry.get(earnSelectionTokenOptionsViewAtom).items
        ).toHaveLength(2)
      );
      expect(
        registry
          .get(earnSelectionTokenOptionsViewAtom)
          .items.every((option) => option.amount === null)
      ).toBe(true);
      expect(registry.get(earnSelectionViewAtom).canSubmit).toBe(false);
      expect(registry.get(earnSelectionStatusViewAtom).blockingFailure).toBe(
        false
      );
      expect(getTokenOptions).toHaveBeenCalledWith({
        enter: true,
        network: "ethereum",
        yieldTypes: undefined,
      });
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("applies focused token transitions and clears yield-scoped form intent", async () => {
    const { registry } = makeRegistry({
      scanTokenBalances: () =>
        Effect.succeed(
          Schema.decodeSync(TokenBalancesResponse)([
            {
              amount: "2",
              availableYields: [firstYield.id],
              token: firstYield.token,
            },
            {
              amount: "1",
              availableYields: [secondYield.id],
              token: secondYield.token,
            },
          ])
        ),
    });
    const unmount = registry.mount(earnSelectionViewAtom);

    try {
      await vi.waitFor(() =>
        expect(
          registry.get(earnSelectionViewAtom).selection.yield
        ).not.toBeNull()
      );
      registry.set(setEarnSelectionAmountAtom, "1.25");
      registry.set(
        selectEarnSelectionTokenAtom,
        tokenString(secondYield.token)
      );
      await vi.waitFor(() =>
        expect(registry.get(earnSelectionViewAtom)).toMatchObject({
          form: { stakeAmount: "0", useMaxAmount: false },
          selection: {
            token: { token: secondYield.token },
            yield: secondYield,
          },
        })
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("keeps a captured initialization seed across Earn route remounts", async () => {
    const { registry } = makeRegistry({
      entry: {
        ...classicEntry,
        initParams: {
          accountId: null,
          balanceId: null,
          network: "ethereum",
          pendingaction: null,
          tab: "earn",
          token: null,
          validator: null,
          yieldId: secondYield.id,
        },
      },
      scanTokenBalances: () =>
        Effect.succeed(
          Schema.decodeSync(TokenBalancesResponse)([
            {
              amount: "2",
              availableYields: [firstYield.id],
              token: firstYield.token,
            },
            {
              amount: "1",
              availableYields: [secondYield.id],
              token: secondYield.token,
            },
          ])
        ),
    });
    let unmount = registry.mount(earnSelectionViewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(earnSelectionViewAtom).selection.yield?.id).toBe(
          secondYield.id
        )
      );
      unmount();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      unmount = registry.mount(earnSelectionViewAtom);

      await vi.waitFor(() =>
        expect(registry.get(earnSelectionViewAtom).selection.yield?.id).toBe(
          secondYield.id
        )
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("does not reopen initialization after user intent completes it", async () => {
    const { registry } = makeRegistry({
      entry: {
        ...classicEntry,
        initParams: {
          accountId: null,
          balanceId: null,
          network: "ethereum",
          pendingaction: null,
          tab: "earn",
          token: null,
          validator: null,
          yieldId: secondYield.id,
        },
      },
      scanTokenBalances: () =>
        Effect.succeed(
          Schema.decodeSync(TokenBalancesResponse)([
            {
              amount: "2",
              availableYields: [firstYield.id],
              token: firstYield.token,
            },
            {
              amount: "1",
              availableYields: [secondYield.id],
              token: secondYield.token,
            },
          ])
        ),
    });
    let unmount = registry.mount(earnSelectionViewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(earnSelectionViewAtom).selection.yield?.id).toBe(
          secondYield.id
        )
      );
      registry.set(selectEarnSelectionTokenAtom, tokenString(firstYield.token));
      await vi.waitFor(() =>
        expect(registry.get(earnSelectionViewAtom).selection.yield?.id).toBe(
          firstYield.id
        )
      );
      unmount();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      unmount = registry.mount(earnSelectionViewAtom);

      await vi.waitFor(() =>
        expect(registry.get(earnSelectionViewAtom).selection.yield?.id).toBe(
          firstYield.id
        )
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("keeps initialization active while the seeded yield is loading", async () => {
    const seededYield = yieldApiYieldFixture({
      id: "ethereum-eth-seeded",
      token: firstYield.token,
    });
    const { registry } = makeRegistry({
      entry: {
        ...classicEntry,
        initParams: {
          accountId: null,
          balanceId: null,
          network: "ethereum",
          pendingaction: null,
          tab: "earn",
          token: null,
          validator: null,
          yieldId: seededYield.id,
        },
      },
      listYields: () =>
        Effect.sleep("100 millis").pipe(
          Effect.as({
            items: [firstYield, seededYield],
            limit: 100,
            offset: 0,
            total: 2,
          })
        ),
      scanTokenBalances: () =>
        Effect.succeed(
          Schema.decodeSync(TokenBalancesResponse)([
            {
              amount: "1",
              availableYields: [firstYield.id, seededYield.id],
              token: firstYield.token,
            },
          ])
        ),
      tokenOptions: [
        {
          availableYields: [firstYield.id, seededYield.id],
          token: firstYield.token,
        },
      ],
    });
    const unmount = registry.mount(earnSelectionViewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(earnSelectionViewAtom).selection.yield?.id).toBe(
          seededYield.id
        )
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("continues a captured initialization seed across remounts while loading", async () => {
    const seededYield = yieldApiYieldFixture({
      id: "ethereum-eth-route-seed",
      token: firstYield.token,
    });
    const { registry } = makeRegistry({
      entry: {
        ...classicEntry,
        initParams: {
          accountId: null,
          balanceId: null,
          network: "ethereum",
          pendingaction: null,
          tab: "earn",
          token: null,
          validator: null,
          yieldId: seededYield.id,
        },
      },
      listYields: () =>
        Effect.sleep("100 millis").pipe(
          Effect.as({
            items: [firstYield, seededYield],
            limit: 100,
            offset: 0,
            total: 2,
          })
        ),
      scanTokenBalances: () =>
        Effect.succeed(
          Schema.decodeSync(TokenBalancesResponse)([
            {
              amount: "1",
              availableYields: [firstYield.id, seededYield.id],
              token: firstYield.token,
            },
          ])
        ),
      tokenOptions: [
        {
          availableYields: [firstYield.id, seededYield.id],
          token: firstYield.token,
        },
      ],
    });
    let unmount = registry.mount(earnSelectionViewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(earnSelectionStatusViewAtom).loading.yields).toBe(
          true
        )
      );
      unmount();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      unmount = registry.mount(earnSelectionViewAtom);

      await vi.waitFor(() =>
        expect(registry.get(earnSelectionViewAtom).selection.yield?.id).toBe(
          seededYield.id
        )
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("derives force-max form state through the feature view", async () => {
    const base = yieldApiYieldDtoFixture();
    const forceMaxYield = yieldApiYieldFixture({
      mechanics: {
        ...base.mechanics,
        arguments: {
          ...base.mechanics.arguments,
          enter: {
            fields: [
              {
                label: "Amount",
                maximum: "-1",
                minimum: "-1",
                name: "amount",
                required: true,
                type: "string",
              },
            ],
          },
        },
      },
      token: firstYield.token,
    });
    const { registry } = makeRegistry({
      listYields: () =>
        Effect.succeed({
          items: [forceMaxYield],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      scanTokenBalances: () =>
        Effect.succeed(
          Schema.decodeSync(TokenBalancesResponse)([
            {
              amount: "10",
              availableYields: [forceMaxYield.id],
              token: forceMaxYield.token,
            },
          ])
        ),
      tokenOptions: [
        {
          availableYields: [forceMaxYield.id],
          token: forceMaxYield.token,
        },
      ],
    });
    const unmount = registry.mount(earnSelectionViewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(earnSelectionViewAtom)).toMatchObject({
          canSubmit: true,
          form: { stakeAmount: "10", useMaxAmount: true },
        })
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
