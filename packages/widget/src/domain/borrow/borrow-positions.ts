import { Schema } from "effect";
import type {
  BorrowAccountSnapshot,
  SupplyBalance,
} from "./borrow-account-snapshot";
import { IntegrationId, type MarketId, type TokenAddress } from "./ids";
import type { Integration } from "./integration";
import type { Market } from "./market";
import { type MarketPosition, makeMarketPosition } from "./market-position";
import { BorrowNetwork } from "./network";
import type { PendingAction } from "./pending-action";
import {
  makeAccountRiskPosition,
  makeMarketRiskPosition,
  type RiskPosition,
} from "./risk-position";

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

export type BorrowPositions = {
  readonly items: ReadonlyArray<MarketPosition>;
  readonly riskFor: (market: Market) => RiskPosition;
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
    const supplyBalancesAddedToDebtPositions = new Set<SupplyBalance>();

    for (const debtBalance of debtBalances) {
      const market = marketsById.get(debtBalance.marketId);
      if (!market) {
        continue;
      }

      const positionSupplyBalances: SupplyBalance[] = [];
      const supplyPendingActions: PendingAction[] = [];

      for (const collateralToken of market.collateralTokens) {
        if (!collateralToken.token.address) {
          continue;
        }

        const supplyBalance = supplyBalancesByMarketId
          .get(debtBalance.marketId)
          ?.get(collateralToken.token.address);
        if (!supplyBalance) {
          continue;
        }

        positionSupplyBalances.push(supplyBalance);
        supplyPendingActions.push(...supplyBalance.pendingActions);
        supplyBalancesAddedToDebtPositions.add(supplyBalance);
      }

      positionsByMarketId.set(
        debtBalance.marketId,
        makeMarketPosition({
          debtBalance,
          debtPendingActions: debtBalance.pendingActions,
          integration,
          market,
          risk: riskFor(market),
          supplyBalances: positionSupplyBalances,
          supplyPendingActions,
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
};
