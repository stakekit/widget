import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { Integration } from "../../src/domain/borrow/integration";
import { Market } from "../../src/domain/borrow/market";
import { BorrowAccountPosition } from "../../src/domain/borrow/position";
import { EarnLegacyTokenOptionsResponse } from "../../src/domain/schema/earn-models";
import {
  TokenBalancesResponse,
  type YieldBalancesCommand,
} from "../../src/domain/schema/financial-models";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import {
  ActivityFilterOptionsKey,
  activityFilterOptionsAtom,
} from "../../src/features/activity/resources/activity-actions";
import {
  ActivityActionsKey,
  getActivityHistoryKey,
} from "../../src/features/activity/resources/activity-requests";
import {
  BorrowPositionKey,
  borrowPositionAtom,
} from "../../src/features/borrow/atoms/resources";
import {
  mergedTokenOptionsAtom,
  positionsDataAtom,
} from "../../src/features/earn/state/atoms-state/catalog/atoms";
import {
  PositionsDataKey,
  TokenOptionsKey,
} from "../../src/features/earn/state/atoms-state/catalog/keys";
import { activityHistoryPullAtom } from "../../src/resources/activity-history/activity-history";
import { BorrowResourceSource } from "../../src/services/api/borrow-resource-source";
import { LegacyResourceSource } from "../../src/services/api/legacy-resource-source";
import {
  type YieldDirectoryRequest,
  YieldResourceSource,
} from "../../src/services/api/yield-resource-source";
import { ActivityInvalidationKey } from "../../src/services/resource-invalidation";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import {
  BorrowTransactionWorkflowInput,
  ClassicTransactionWorkflowInput,
} from "../../src/services/workflow/transaction-workflow-model";
import { getTransactionWorkflowInvalidationKeys } from "../../src/services/workflow/transaction-workflow-operations-service";
import { getPullResultItems } from "../../src/shared/effect/pagination";
import { yieldApiActionFixture, yieldApiYieldFixture } from "../fixtures";

const address = (suffix: string) =>
  Schema.decodeSync(WalletAddress)(`0x${suffix.padStart(40, "0")}`);
const scopeA = new WalletScopeKey({
  address: address("1"),
  network: "ethereum",
});
const scopeB = new WalletScopeKey({
  address: address("2"),
  network: "ethereum",
});

const getActivityActionViews = (
  result: Atom.Type<ReturnType<typeof activityHistoryPullAtom>>
) => getPullResultItems(result).flatMap((batch) => batch.actions);
const sameWalletCachedScope = new WalletScopeKey({
  additionalAddresses: {
    lidoStakeAccounts: ["cached-lido-account"],
    stakeAccounts: ["cached-stake-account"],
  },
  address: Schema.decodeSync(WalletAddress)(
    "0x00000000000000000000000000000000000000ab"
  ),
  network: "ethereum",
});
const sameAddressOtherNetworkScope = new WalletScopeKey({
  address: sameWalletCachedScope.address,
  network: "base",
});
const yieldDto = yieldApiYieldFixture();
const yieldId = Schema.decodeSync(YieldId)(yieldDto.id);
const borrowIntegration = Schema.decodeUnknownSync(Integration)({
  actions: [],
  id: "aave-borrow",
  metadata: {
    description: "Aave lending and borrowing",
    externalLink: "https://aave.com",
    logoURI: "https://assets.stakek.it/protocols/aave.svg",
  },
  name: "Aave V3",
  networks: ["ethereum"],
  providerId: "aave",
});
const borrowMarket = Schema.decodeUnknownSync(Market)({
  availableLiquidity: "500000",
  availableLiquidityRaw: "500000000000",
  borrowRate: "0.06",
  collateralTokens: [
    {
      liquidationPenalty: "0.05",
      liquidationThreshold: "0.85",
      maxLtv: "0.8",
      priceUsd: "2000",
      supplyRate: "0.02",
      token: {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        decimals: 18,
        name: "Wrapped Ether",
        symbol: "WETH",
      },
    },
  ],
  feeWrapperAddress: null,
  id: "aave-v3-ethereum-usdc",
  integrationId: borrowIntegration.id,
  isBorrowEnabled: true,
  loanToken: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  loanTokenPriceUsd: "1",
  minLoan: null,
  network: "ethereum",
  poolAddress: "0x0000000000000000000000000000000000000001",
  supplyCollateralFeeBps: "0",
  totalBorrow: "500000",
  totalBorrowRaw: "500000000000",
  totalSupply: "1000000",
  totalSupplyRaw: "1000000000000",
  type: "pool",
  utilizationRate: "0.5",
});
const borrowAccountPosition = (updated: boolean) =>
  Schema.decodeUnknownSync(BorrowAccountPosition)({
    address: scopeA.address,
    availableToBorrowUsd: updated ? "750" : "450",
    currentLtv: updated ? "0.1" : "0.4",
    debtBalances: [
      {
        apy: "0.06",
        balance: updated ? "100" : "400",
        balanceRaw: updated ? "100000000" : "400000000",
        balanceUsd: updated ? "100" : "400",
        marketId: borrowMarket.id,
        pendingActions: updated
          ? []
          : [
              {
                args: {
                  marketId: borrowMarket.id,
                  tokenAddress: borrowMarket.loanToken.address,
                },
                label: "Repay",
                type: "repay",
              },
            ],
        tokenAddress: borrowMarket.loanToken.address,
        tokenSymbol: "USDC",
      },
    ],
    healthFactor: updated ? "8" : "2.125",
    integrationId: borrowIntegration.id,
    netApy: "-0.006",
    netWorthUsd: updated ? "900" : "600",
    network: "ethereum",
    supplyBalances: [],
    totalBorrowedUsd: updated ? "100" : "400",
    totalCollateralUsd: "0",
    totalSuppliedUsd: "0",
  });
const reactivityAtom = appRuntime.atom(
  Effect.gen(function* () {
    return yield* Reactivity.Reactivity;
  })
);

const workflowInvalidationKeys = (scope: WalletScopeKey) =>
  getTransactionWorkflowInvalidationKeys(
    new ClassicTransactionWorkflowInput({
      actionMeta: {
        actionId: "completed-action",
        address: scope.address,
      } as never,
      transactions: [],
      walletScope: scope,
      yieldId,
    })
  );

describe("semantic resource invalidation", () => {
  it("refreshes idle Earn bases for the workflow wallet scope only", async () => {
    const versions = new Map([
      [sameWalletCachedScope.address.toLowerCase(), "1"],
      [scopeB.address.toLowerCase(), "2"],
    ]);
    const balanceCalls = new Map<string, number>();
    const positionCalls = new Map<string, number>();
    const getLegacyTokenOptions = vi.fn(() =>
      Effect.succeed(
        Schema.decodeUnknownSync(EarnLegacyTokenOptionsResponse)([
          { availableYields: [yieldId], token: yieldDto.token },
        ])
      )
    );
    const scanTokenBalances = vi.fn(
      ({
        addresses: { address: walletAddress },
      }: {
        readonly addresses: { readonly address: WalletAddress };
      }) => {
        balanceCalls.set(
          walletAddress,
          (balanceCalls.get(walletAddress) ?? 0) + 1
        );
        return Effect.succeed(
          Schema.decodeUnknownSync(TokenBalancesResponse)([
            {
              amount: versions.get(walletAddress.toLowerCase()) ?? "0",
              availableYields: [yieldId],
              token: yieldDto.token,
            },
          ])
        );
      }
    );
    const getPositions = vi.fn((command: YieldBalancesCommand) => {
      const walletAddress = command.queries[0]!.address;
      positionCalls.set(
        walletAddress,
        (positionCalls.get(walletAddress) ?? 0) + 1
      );
      return Effect.succeed({ errors: [], items: [] });
    });
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Reactivity.layer,
            Layer.succeed(LegacyResourceSource, {
              getTokenOptions: getLegacyTokenOptions,
              scanTokenBalances,
            } as never),
            Layer.succeed(YieldResourceSource, { getPositions } as never)
          ) as never
        ),
      ],
    });
    const tokenOptions = (scope: WalletScopeKey) =>
      mergedTokenOptionsAtom(
        new TokenOptionsKey({
          category: null,
          initToken: null,
          initTokenNetwork: null,
          initYieldId: null,
          scope,
          tokensForEnabledYieldsOnly: false,
        })
      );
    const positions = (scope: WalletScopeKey) =>
      positionsDataAtom(new PositionsDataKey({ scope }));
    const aTokens = tokenOptions(sameWalletCachedScope);
    const bTokens = tokenOptions(scopeB);
    const aPositions = positions(sameWalletCachedScope);
    const bPositions = positions(scopeB);
    const unmountA = [registry.mount(aTokens), registry.mount(aPositions)];
    const unmountB = [registry.mount(bTokens), registry.mount(bPositions)];
    const unmountReactivity = registry.mount(reactivityAtom);

    await vi.waitFor(() => {
      expect(AsyncResult.getOrThrow(registry.get(aTokens))[0]?.amount).toBe(
        "1"
      );
      expect(AsyncResult.getOrThrow(registry.get(bTokens))[0]?.amount).toBe(
        "2"
      );
      expect(positionCalls).toEqual(
        new Map([
          [sameWalletCachedScope.address, 1],
          [scopeB.address, 1],
        ])
      );
      expect(AsyncResult.isSuccess(registry.get(reactivityAtom))).toBe(true);
    });
    unmountA.forEach((unmount) => unmount());
    versions.set(sameWalletCachedScope.address.toLowerCase(), "10");
    const reactivity = AsyncResult.getOrThrow(registry.get(reactivityAtom));

    await Effect.runPromise(
      reactivity.withBatch(
        reactivity.invalidate(workflowInvalidationKeys(sameWalletCachedScope))
      )
    );
    await vi.waitFor(() => {
      expect(balanceCalls.get(sameWalletCachedScope.address)).toBe(2);
      expect(positionCalls.get(sameWalletCachedScope.address)).toBe(2);
    });

    const remountA = [registry.mount(aTokens), registry.mount(aPositions)];
    await vi.waitFor(() =>
      expect(AsyncResult.getOrThrow(registry.get(aTokens))[0]?.amount).toBe(
        "10"
      )
    );
    expect(balanceCalls.get(scopeB.address)).toBe(1);
    expect(positionCalls.get(scopeB.address)).toBe(1);

    remountA.forEach((unmount) => unmount());
    unmountB.forEach((unmount) => unmount());
    unmountReactivity();
    registry.dispose();
  });

  it("refreshes Activity Pull and bounded filter counts from the first page", async () => {
    let version = 1;
    const activityRequests: Array<{
      address: WalletAddress;
      limit: number;
      network: string;
      offset: number;
      yieldTypes?: ReadonlyArray<string>;
    }> = [];
    const getActivityActions = vi.fn(
      (request: {
        readonly address: WalletAddress;
        readonly limit: number;
        readonly network: string;
        readonly offset: number;
        readonly yieldTypes?: ReadonlyArray<string>;
      }) => {
        activityRequests.push({
          address: request.address,
          limit: request.limit,
          network: request.network,
          offset: request.offset,
          yieldTypes: request.yieldTypes,
        });
        if (request.limit === 1) {
          return Effect.succeed({
            items: [],
            limit: 1,
            offset: 0,
            total: version === 1 ? 2 : 1,
          });
        }

        const id =
          version === 2
            ? "updated-action"
            : request.offset === 0
              ? "old-action-1"
              : "old-action-2";
        return Effect.succeed({
          items: [yieldApiActionFixture({ id, yieldId })],
          limit: version === 1 ? 1 : 50,
          offset: request.offset,
          total: version === 1 ? 2 : 1,
        });
      }
    );
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Reactivity.layer,
            Layer.succeed(YieldResourceSource, {
              getOpportunity: () => Effect.succeed(yieldDto),
              getProvider: () => Effect.fail("no provider"),
              listActivity: getActivityActions,
              listYields: ({ limit, offset }: YieldDirectoryRequest) =>
                Effect.succeed({
                  items: [yieldDto],
                  limit,
                  offset,
                  total: 1,
                }),
            } as never)
          ) as never
        ),
      ],
    });
    const historyKey = (scope: WalletScopeKey) =>
      getActivityHistoryKey(new ActivityActionsKey({ filter: "all", scope }))!;
    const actions = activityHistoryPullAtom(historyKey(sameWalletCachedScope));
    const filters = activityFilterOptionsAtom(
      new ActivityFilterOptionsKey({ scope: sameWalletCachedScope })
    );
    const otherWalletActions = activityHistoryPullAtom(historyKey(scopeB));
    const otherNetworkActions = activityHistoryPullAtom(
      historyKey(sameAddressOtherNetworkScope)
    );
    const unmountActions = registry.mount(actions);
    const unmountFilters = registry.mount(filters);
    const unmountOtherWalletActions = registry.mount(otherWalletActions);
    const unmountOtherNetworkActions = registry.mount(otherNetworkActions);
    const unmountReactivity = registry.mount(reactivityAtom);

    await vi.waitFor(() => {
      expect(
        getActivityActionViews(registry.get(actions)).map(({ id }) => id)
      ).toEqual(["old-action-1"]);
      expect(
        getActivityActionViews(registry.get(otherWalletActions)).map(
          ({ id }) => id
        )
      ).toEqual(["old-action-1"]);
      expect(
        getActivityActionViews(registry.get(otherNetworkActions)).map(
          ({ id }) => id
        )
      ).toEqual(["old-action-1"]);
    });
    registry.set(actions, undefined);
    registry.set(otherWalletActions, undefined);
    registry.set(otherNetworkActions, undefined);
    await vi.waitFor(() => {
      expect(
        getActivityActionViews(registry.get(actions)).map(({ id }) => id)
      ).toEqual(["old-action-1", "old-action-2"]);
      expect(
        getActivityActionViews(registry.get(otherWalletActions)).map(
          ({ id }) => id
        )
      ).toEqual(["old-action-1", "old-action-2"]);
      expect(
        getActivityActionViews(registry.get(otherNetworkActions)).map(
          ({ id }) => id
        )
      ).toEqual(["old-action-1", "old-action-2"]);
    });
    await vi.waitFor(() =>
      expect(AsyncResult.isSuccess(registry.get(filters))).toBe(true)
    );
    expect(
      activityRequests
        .filter(
          ({ address: requestAddress, limit, network }) =>
            requestAddress === sameWalletCachedScope.address &&
            network === sameWalletCachedScope.network &&
            limit > 1
        )
        .every(({ yieldTypes }) => yieldTypes === undefined)
    ).toBe(true);
    const countRequestsBefore = activityRequests.filter(
      ({ address: requestAddress, network }) =>
        requestAddress === sameWalletCachedScope.address &&
        network === sameWalletCachedScope.network
    ).length;
    const otherWalletRequestsBefore = activityRequests.filter(
      ({ address: requestAddress }) => requestAddress === scopeB.address
    ).length;
    const otherNetworkRequestsBefore = activityRequests.filter(
      ({ address: requestAddress, network }) =>
        requestAddress === sameAddressOtherNetworkScope.address &&
        network === sameAddressOtherNetworkScope.network
    ).length;
    version = 2;
    const reactivity = AsyncResult.getOrThrow(registry.get(reactivityAtom));

    await Effect.runPromise(
      reactivity.invalidate([
        new ActivityInvalidationKey({ scope: sameWalletCachedScope }),
      ])
    );
    await vi.waitFor(() =>
      expect(
        getActivityActionViews(registry.get(actions)).map(({ id }) => id)
      ).toEqual(["updated-action"])
    );
    expect(
      activityRequests.filter(
        ({ address: requestAddress, network }) =>
          requestAddress === sameWalletCachedScope.address &&
          network === sameWalletCachedScope.network
      ).length
    ).toBeGreaterThan(countRequestsBefore);
    expect(
      activityRequests.filter(
        ({ address: requestAddress }) => requestAddress === scopeB.address
      )
    ).toHaveLength(otherWalletRequestsBefore);
    expect(
      activityRequests.filter(
        ({ address: requestAddress, network }) =>
          requestAddress === sameAddressOtherNetworkScope.address &&
          network === sameAddressOtherNetworkScope.network
      )
    ).toHaveLength(otherNetworkRequestsBefore);

    unmountActions();
    unmountFilters();
    unmountOtherWalletActions();
    unmountOtherNetworkActions();
    unmountReactivity();
    registry.dispose();
  });

  it("refreshes the canonical Borrow base and its mounted detail projection", async () => {
    let updated = false;
    const getIntegrations = vi.fn(() => Effect.succeed([borrowIntegration]));
    const getMarkets = vi.fn(() =>
      Effect.succeed({
        items: [borrowMarket],
        limit: 100,
        offset: 0,
        total: 1,
      })
    );
    const getPositionData = vi.fn(() =>
      Effect.succeed([
        {
          integration: borrowIntegration,
          position: borrowAccountPosition(updated),
        },
      ])
    );
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Reactivity.layer,
            Layer.succeed(BorrowResourceSource, {
              getIntegrations,
              getMarkets,
              getPositionData,
            } as never)
          ) as never
        ),
      ],
    });
    const detail = borrowPositionAtom(
      new BorrowPositionKey({
        marketId: borrowMarket.id,
        scope: scopeA,
      })
    );
    const unmountDetail = registry.mount(detail);
    const unmountReactivity = registry.mount(reactivityAtom);

    await vi.waitFor(() => {
      const value = AsyncResult.getOrThrow(registry.get(detail));
      expect(value.debtBalance?.balance).toBe(400);
      expect(value.debtBalance?.pendingActions).toHaveLength(1);
    });
    updated = true;
    const action = {
      action: "repay",
      address: scopeA.address,
      createdAt: new Date().toISOString(),
      currentStep: 1,
      hasNextStep: false,
      id: "borrow-action",
      integrationId: borrowIntegration.id,
      status: "SUCCESS",
      totalSteps: 1,
      transactions: [],
    } as never;
    const keys = getTransactionWorkflowInvalidationKeys(
      new BorrowTransactionWorkflowInput({ action, walletScope: scopeA })
    );
    const reactivity = AsyncResult.getOrThrow(registry.get(reactivityAtom));

    await Effect.runPromise(reactivity.withBatch(reactivity.invalidate(keys)));
    await vi.waitFor(() => {
      const value = AsyncResult.getOrThrow(registry.get(detail));
      expect(value.debtBalance?.balance).toBe(100);
      expect(value.debtBalance?.pendingActions).toHaveLength(0);
    });
    expect(getIntegrations).toHaveBeenCalledOnce();
    expect(getMarkets).toHaveBeenCalledTimes(2);
    expect(getPositionData).toHaveBeenCalledTimes(2);

    unmountDetail();
    unmountReactivity();
    registry.dispose();
  });
});
