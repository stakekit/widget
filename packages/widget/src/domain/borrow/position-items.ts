import type { MarketId, TokenAddress } from "./ids";
import type { Integration } from "./integration";
import type { Market } from "./market";
import type { PendingAction } from "./pending-action";
import type { BorrowAccountPosition } from "./position";
import { Position, type SupplyBalance } from "./position";

type IntegrationPosition = {
  readonly integration: Integration;
  readonly position: BorrowAccountPosition;
};

export const deriveBorrowPositionItems = ({
  integrationPositions,
  markets,
}: {
  readonly integrationPositions: ReadonlyArray<IntegrationPosition>;
  readonly markets: ReadonlyArray<Market>;
}): Position[] => {
  const marketsById = new Map(markets.map((market) => [market.id, market]));
  const positionsByMarketId = new Map<MarketId, Position>();

  for (const integrationPosition of integrationPositions) {
    const debtBalances = integrationPosition.position.debtBalances;
    const supplyBalances = integrationPosition.position.supplyBalances;
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
        new Position({
          debtBalance,
          debtPendingActions: debtBalance.pendingActions,
          id: debtBalance.marketId,
          integration: integrationPosition.integration,
          market,
          positionState:
            positionSupplyBalances.find(
              (supplyBalance) => supplyBalance.positionState
            )?.positionState ?? null,
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
          new Position({
            debtBalance: existingPosition.debtBalance,
            debtPendingActions: existingPosition.debtPendingActions,
            id: existingPosition.id,
            integration: existingPosition.integration,
            market: existingPosition.market,
            positionState:
              existingPosition.positionState ??
              supplyBalance.positionState ??
              null,
            supplyBalances: [...existingPosition.supplyBalances, supplyBalance],
            supplyPendingActions: [
              ...existingPosition.supplyPendingActions,
              ...supplyBalance.pendingActions,
            ],
          })
        );
        continue;
      }

      positionsByMarketId.set(
        supplyBalance.marketId,
        new Position({
          debtBalance: null,
          debtPendingActions: [],
          id: supplyBalance.marketId,
          integration: integrationPosition.integration,
          market,
          positionState: supplyBalance.positionState ?? null,
          supplyBalances: [supplyBalance],
          supplyPendingActions: supplyBalance.pendingActions,
        })
      );
    }
  }

  return [...positionsByMarketId.values()];
};
