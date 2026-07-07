import * as Schema from "effect/Schema";
import type { PositionDto } from "../../generated/api/borrow";
import type { MarketId } from "./ids";
import type { Integration } from "./integration";
import type { Market } from "./market";
import type { PendingAction } from "./pending-action";
import { DebtBalance, Position, SupplyBalance } from "./position";

type IntegrationPosition = {
  readonly integration: Integration;
  readonly position: PositionDto;
};

const decodeDebtBalance = Schema.decodeUnknownSync(DebtBalance);
const decodeSupplyBalance = Schema.decodeUnknownSync(SupplyBalance);

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
    const debtBalances = integrationPosition.position.debtBalances.map(
      (balance) => decodeDebtBalance(balance)
    );
    const supplyBalances = integrationPosition.position.supplyBalances.map(
      (balance) => decodeSupplyBalance(balance)
    );
    const supplyBalancesByTokenAddress = new Map(
      supplyBalances.map((supplyBalance) => [
        supplyBalance.tokenAddress,
        supplyBalance,
      ])
    );
    const supplyBalancesAddedToDebtPositions = new Set<string>();

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

        const supplyBalance = supplyBalancesByTokenAddress.get(
          collateralToken.token.address
        );

        if (!supplyBalance) {
          continue;
        }

        positionSupplyBalances.push(supplyBalance);
        supplyPendingActions.push(...supplyBalance.pendingActions);
        supplyBalancesAddedToDebtPositions.add(supplyBalance.tokenAddress);
      }

      positionsByMarketId.set(
        debtBalance.marketId,
        new Position({
          debtBalance,
          debtPendingActions: debtBalance.pendingActions,
          id: debtBalance.marketId,
          integration: integrationPosition.integration,
          market,
          supplyBalances: positionSupplyBalances,
          supplyPendingActions,
        })
      );
    }

    for (const supplyBalance of supplyBalances) {
      if (supplyBalancesAddedToDebtPositions.has(supplyBalance.tokenAddress)) {
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
          supplyBalances: [supplyBalance],
          supplyPendingActions: supplyBalance.pendingActions,
        })
      );
    }
  }

  return [...positionsByMarketId.values()];
};
