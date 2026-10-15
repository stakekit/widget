import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { exactZero, sumExact } from "../../finance/exact";
import type { Integration } from "../catalog/integration";
import type { Market } from "../catalog/market";
import { IntegrationId, type MarketId, type TokenAddress } from "../ids";
import { BorrowNetwork } from "../network";
import {
  makeAccountRiskPosition,
  makeMarketRiskPosition,
  type RiskPosition,
} from "../risk/risk-position";
import type {
  BorrowAccountSnapshot,
  SupplyBalance,
} from "./borrow-account-snapshot";
import { type MarketPosition, makeMarketPosition } from "./market-position";

type IntegrationAccountSnapshot = {
  readonly accountSnapshot: BorrowAccountSnapshot;
  readonly integration: Integration;
};

const PoolRiskId = Schema.TemplateLiteral([
  BorrowNetwork,
  Schema.Literal(":"),
  IntegrationId,
]).pipe(Schema.brand("BorrowPoolRiskId"));
type PoolRiskId = typeof PoolRiskId.Type;

const decodePoolRiskId = Schema.decodeSync(PoolRiskId);

/**
 * Portfolio-wide borrow totals summed per account snapshot, so pool collateral
 * shared by several debt positions is counted once.
 */
type BorrowAccountTotals = {
  /** Net APY weighted by `netApyWeightUsd`. */
  readonly netApy: BigNumber;
  /** Sum of positive account net worth; accounts at or below zero earn nothing. */
  readonly netApyWeightUsd: BigNumber;
  readonly netWorthUsd: BigNumber;
  readonly totalSuppliedUsd: BigNumber;
};

export type BorrowPositions = {
  readonly items: ReadonlyArray<MarketPosition>;
  readonly riskFor: (market: Market) => RiskPosition;
  readonly totals: BorrowAccountTotals;
};

const deriveBorrowAccountTotals = (
  accountSnapshots: ReadonlyArray<BorrowAccountSnapshot>
): BorrowAccountTotals => {
  const earningNetWorths = accountSnapshots.map((snapshot) =>
    BigNumber.max(snapshot.netWorthUsd, exactZero())
  );
  const netApyWeightUsd = sumExact(earningNetWorths);
  const weightedNetApy = sumExact(
    accountSnapshots.map((snapshot, index) =>
      snapshot.netApy.multipliedBy(earningNetWorths[index] ?? exactZero())
    )
  );

  return {
    netApy: netApyWeightUsd.isZero()
      ? exactZero()
      : weightedNetApy.dividedBy(netApyWeightUsd),
    netApyWeightUsd,
    netWorthUsd: sumExact(
      accountSnapshots.map((snapshot) => snapshot.netWorthUsd)
    ),
    totalSuppliedUsd: sumExact(
      accountSnapshots.map((snapshot) => snapshot.totalSuppliedUsd)
    ),
  };
};

const getPoolRiskId = ({
  integrationId,
  network,
}: Pick<Market, "integrationId" | "network">): PoolRiskId =>
  decodePoolRiskId(`${network}:${integrationId}`);

export const deriveBorrowPositions = ({
  integrationAccountSnapshots,
  markets,
}: {
  readonly integrationAccountSnapshots: ReadonlyArray<IntegrationAccountSnapshot>;
  readonly markets: ReadonlyArray<Market>;
}): BorrowPositions => {
  const marketsById = new Map(markets.map((market) => [market.id, market]));
  const accountSnapshotsByPoolRiskId = new Map<
    PoolRiskId,
    BorrowAccountSnapshot
  >(
    integrationAccountSnapshots.map(({ accountSnapshot }) => [
      getPoolRiskId(accountSnapshot),
      accountSnapshot,
    ])
  );
  const poolMarketsByRiskId = new Map<PoolRiskId, Market[]>();
  for (const market of markets) {
    if (market.type !== "pool") {
      continue;
    }

    const poolRiskId = getPoolRiskId(market);
    poolMarketsByRiskId.set(poolRiskId, [
      ...(poolMarketsByRiskId.get(poolRiskId) ?? []),
      market,
    ]);
  }
  const poolRiskById = new Map<PoolRiskId, RiskPosition>();
  const isolatedRiskByMarketId = new Map<MarketId, RiskPosition>();
  const riskFor = (market: Market): RiskPosition => {
    if (market.type === "pool") {
      const poolRiskId = getPoolRiskId(market);
      const existing = poolRiskById.get(poolRiskId);
      if (existing) {
        return existing;
      }

      const risk = makeAccountRiskPosition({
        markets: poolMarketsByRiskId.get(poolRiskId) ?? [market],
        snapshot: accountSnapshotsByPoolRiskId.get(poolRiskId) ?? null,
      });
      poolRiskById.set(poolRiskId, risk);
      return risk;
    }

    const existing = isolatedRiskByMarketId.get(market.id);
    if (existing) {
      return existing;
    }

    const snapshot = accountSnapshotsByPoolRiskId.get(getPoolRiskId(market));
    const risk = makeMarketRiskPosition({
      debtBalance:
        snapshot?.debtBalances.find(
          (balance) => balance.marketId === market.id
        ) ?? null,
      market,
      supplyBalances:
        snapshot?.supplyBalances.filter(
          (balance) => balance.marketId === market.id
        ) ?? [],
    });
    isolatedRiskByMarketId.set(market.id, risk);
    return risk;
  };
  const positionsByMarketId = new Map<MarketId, MarketPosition>();

  for (const { accountSnapshot, integration } of integrationAccountSnapshots) {
    const debtBalances = accountSnapshot.debtBalances;
    const supplyBalances = accountSnapshot.supplyBalances;
    // The API keys every Aave balance by its own reserve, and every enabled
    // collateral backs every debt in the pool, so pool collateral is matched
    // by the collateral flag instead of by market.
    const poolCollateralBalances = supplyBalances.filter(
      (balance) => balance.isCollateral
    );
    const poolAccountMetricsFor = (market: Market) =>
      market.type === "pool"
        ? {
            netApy: accountSnapshot.netApy,
            netWorthUsd: accountSnapshot.netWorthUsd,
          }
        : null;
    const supplyBalancesByMarketId = new Map<
      MarketId,
      Map<TokenAddress, SupplyBalance>
    >();
    for (const supplyBalance of supplyBalances) {
      const balancesByTokenAddress =
        supplyBalancesByMarketId.get(supplyBalance.marketId) ?? new Map();
      balancesByTokenAddress.set(supplyBalance.tokenAddress, supplyBalance);
      supplyBalancesByMarketId.set(
        supplyBalance.marketId,
        balancesByTokenAddress
      );
    }
    const isolatedCollateralBalancesFor = (market: Market) =>
      market.collateralTokens.flatMap((collateralToken) => {
        const supplyBalance = collateralToken.token.address
          ? supplyBalancesByMarketId
              .get(market.id)
              ?.get(collateralToken.token.address)
          : undefined;

        return supplyBalance ? [supplyBalance] : [];
      });
    const supplyBalancesAddedToDebtPositions = new Set<SupplyBalance>();

    for (const debtBalance of debtBalances) {
      const market = marketsById.get(debtBalance.marketId);
      if (!market) {
        continue;
      }

      const positionSupplyBalances =
        market.type === "pool"
          ? poolCollateralBalances
          : isolatedCollateralBalancesFor(market);
      for (const supplyBalance of positionSupplyBalances) {
        supplyBalancesAddedToDebtPositions.add(supplyBalance);
      }

      positionsByMarketId.set(
        debtBalance.marketId,
        makeMarketPosition({
          debtBalance,
          debtPendingActions: debtBalance.pendingActions,
          integration,
          market,
          poolAccountMetrics: poolAccountMetricsFor(market),
          risk: riskFor(market),
          supplyBalances: positionSupplyBalances,
          supplyPendingActions: positionSupplyBalances.flatMap(
            (balance) => balance.pendingActions
          ),
        })
      );
    }

    for (const supplyBalance of supplyBalances) {
      if (supplyBalancesAddedToDebtPositions.has(supplyBalance)) {
        continue;
      }

      const market = marketsById.get(supplyBalance.marketId);
      if (!market) {
        continue;
      }

      const existingPosition = positionsByMarketId.get(supplyBalance.marketId);
      if (existingPosition) {
        positionsByMarketId.set(
          supplyBalance.marketId,
          makeMarketPosition({
            debtBalance: existingPosition.balances.debt,
            debtPendingActions: existingPosition.actions.debt,
            integration: existingPosition.integration,
            market: existingPosition.market,
            poolAccountMetrics: poolAccountMetricsFor(existingPosition.market),
            risk: existingPosition.risk,
            supplyBalances: [
              ...existingPosition.balances.supply,
              supplyBalance,
            ],
            supplyPendingActions: [
              ...existingPosition.actions.supply,
              ...supplyBalance.pendingActions,
            ],
          })
        );
        continue;
      }

      positionsByMarketId.set(
        supplyBalance.marketId,
        makeMarketPosition({
          debtBalance: null,
          debtPendingActions: [],
          integration,
          market,
          poolAccountMetrics: poolAccountMetricsFor(market),
          risk: riskFor(market),
          supplyBalances: [supplyBalance],
          supplyPendingActions: supplyBalance.pendingActions,
        })
      );
    }
  }

  return {
    items: [...positionsByMarketId.values()],
    riskFor,
    totals: deriveBorrowAccountTotals(
      integrationAccountSnapshots.map(({ accountSnapshot }) => accountSnapshot)
    ),
  };
};

export const emptyBorrowPositions: BorrowPositions = {
  items: [],
  riskFor: (market) =>
    market.type === "pool"
      ? makeAccountRiskPosition({ markets: [market], snapshot: null })
      : makeMarketRiskPosition({
          debtBalance: null,
          market,
          supplyBalances: [],
        }),
  totals: deriveBorrowAccountTotals([]),
};
