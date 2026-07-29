import { Array as EArray, pipe, Result } from "effect";
import { sumAll } from "effect/Number";
import type { DebtBalance, SupplyBalance } from "./borrow-account-snapshot";
import type { MarketId } from "./ids";
import type { Integration } from "./integration";
import type { Market } from "./market";
import type { PendingAction } from "./pending-action";
import type { RiskPosition } from "./risk-position";

export type MarketPosition = {
  readonly actions: {
    readonly debt: ReadonlyArray<PendingAction>;
    readonly supply: ReadonlyArray<PendingAction>;
  };
  readonly balances: {
    readonly debt: DebtBalance | null;
    readonly supply: ReadonlyArray<SupplyBalance>;
  };
  readonly id: MarketId;
  readonly integration: Integration;
  readonly market: Market;
  readonly metrics: {
    readonly borrowApy: number | null;
    readonly netApy: number;
    readonly netWorthUsd: number;
    readonly totalBorrowedUsd: number;
    readonly totalCollateralUsd: number;
    readonly totalSuppliedUsd: number;
  };
  readonly risk: RiskPosition;
};

export const deriveMarketPositionOverview = (position: MarketPosition) => {
  const debtBalance = position.balances.debt;
  const collateralBalances = position.balances.supply.filter(
    (balance) => balance.isCollateral
  );
  const primaryCollateral = collateralBalances[0];
  const supplyHeaderToken = position.market.collateralTokens.find(
    (collateralToken) =>
      collateralToken.token.address ===
      position.balances.supply[0]?.tokenAddress
  )?.token;

  return {
    currentLtv:
      position.risk.current.status === "available"
        ? position.risk.current.ltv
        : null,
    headerToken: debtBalance
      ? position.market.loanToken
      : (supplyHeaderToken ?? position.market.loanToken),
    title:
      debtBalance && collateralBalances.length === 1 && primaryCollateral
        ? `${primaryCollateral.tokenSymbol}/${debtBalance.tokenSymbol}`
        : position.market.loanToken.symbol,
  };
};

const sumSupplyUsd = (balances: ReadonlyArray<SupplyBalance>) =>
  pipe(
    balances.map((balance) => balance.balanceUsd),
    sumAll
  );

const sumCollateralUsd = (balances: ReadonlyArray<SupplyBalance>) =>
  pipe(
    EArray.filterMap(balances, (balance) =>
      balance.isCollateral
        ? Result.succeed(balance.balanceUsd)
        : Result.failVoid
    ),
    sumAll
  );

export const makeMarketPosition = ({
  debtBalance,
  debtPendingActions,
  integration,
  market,
  risk,
  supplyBalances,
  supplyPendingActions,
}: {
  readonly debtBalance: DebtBalance | null;
  readonly debtPendingActions: ReadonlyArray<PendingAction>;
  readonly integration: Integration;
  readonly market: Market;
  readonly risk: RiskPosition;
  readonly supplyBalances: ReadonlyArray<SupplyBalance>;
  readonly supplyPendingActions: ReadonlyArray<PendingAction>;
}): MarketPosition => {
  const totalSuppliedUsd = sumSupplyUsd(supplyBalances);
  const totalBorrowedUsd = debtBalance?.balanceUsd ?? 0;
  const netWorthUsd = totalSuppliedUsd - totalBorrowedUsd;
  const totalSupplyEarnings = pipe(
    supplyBalances.map((balance) => balance.balanceUsd * balance.apy),
    sumAll
  );
  const totalBorrowCosts =
    (debtBalance?.balanceUsd ?? 0) * (debtBalance?.apy ?? 0);

  return {
    actions: {
      debt: debtPendingActions,
      supply: supplyPendingActions,
    },
    balances: {
      debt: debtBalance,
      supply: supplyBalances,
    },
    id: market.id,
    integration,
    market,
    metrics: {
      borrowApy: debtBalance?.apy ?? null,
      netApy:
        netWorthUsd === 0
          ? 0
          : (totalSupplyEarnings - totalBorrowCosts) / netWorthUsd,
      netWorthUsd,
      totalBorrowedUsd,
      totalCollateralUsd: sumCollateralUsd(supplyBalances),
      totalSuppliedUsd,
    },
    risk,
  };
};
