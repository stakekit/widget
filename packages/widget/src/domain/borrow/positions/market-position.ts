import type BigNumber from "bignumber.js";
import { Array as EArray, Result } from "effect";
import { exactZero, sumExact } from "../../finance/exact";
import type { Integration } from "../catalog/integration";
import type { Market } from "../catalog/market";
import type { MarketId } from "../ids";
import type { RiskPosition } from "../risk/risk-position";
import type { DebtBalance, SupplyBalance } from "./borrow-account-snapshot";
import type { PendingAction } from "./pending-action";

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
    readonly borrowApy: BigNumber | null;
    readonly netApy: BigNumber;
    readonly netWorthUsd: BigNumber;
    readonly totalBorrowedUsd: BigNumber;
    readonly totalCollateralUsd: BigNumber;
    readonly totalSuppliedUsd: BigNumber;
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
  sumExact(balances.map((balance) => balance.balanceUsd));

const sumCollateralUsd = (balances: ReadonlyArray<SupplyBalance>) =>
  sumExact(
    EArray.filterMap(balances, (balance) =>
      balance.isCollateral
        ? Result.succeed(balance.balanceUsd)
        : Result.failVoid
    )
  );

type NetMetrics = {
  readonly netApy: BigNumber;
  readonly netWorthUsd: BigNumber;
};

const deriveMarketNetMetrics = ({
  debtBalance,
  supplyBalances,
  totalBorrowedUsd,
  totalSuppliedUsd,
}: {
  readonly debtBalance: DebtBalance | null;
  readonly supplyBalances: ReadonlyArray<SupplyBalance>;
  readonly totalBorrowedUsd: BigNumber;
  readonly totalSuppliedUsd: BigNumber;
}): NetMetrics => {
  const netWorthUsd = totalSuppliedUsd.minus(totalBorrowedUsd);

  if (!netWorthUsd.isGreaterThan(0)) {
    return { netApy: exactZero(), netWorthUsd };
  }

  const totalSupplyEarnings = sumExact(
    supplyBalances.map((balance) =>
      balance.balanceUsd.multipliedBy(balance.apy)
    )
  );
  const totalBorrowCosts = totalBorrowedUsd.multipliedBy(
    debtBalance?.apy ?? exactZero()
  );

  return {
    netApy: totalSupplyEarnings.minus(totalBorrowCosts).dividedBy(netWorthUsd),
    netWorthUsd,
  };
};

export const makeMarketPosition = ({
  debtBalance,
  debtPendingActions,
  integration,
  market,
  poolAccountMetrics,
  risk,
  supplyBalances,
  supplyPendingActions,
}: {
  readonly debtBalance: DebtBalance | null;
  readonly debtPendingActions: ReadonlyArray<PendingAction>;
  readonly integration: Integration;
  readonly market: Market;
  /**
   * Account-level values the API reports for a pooled account (Aave). Pool
   * collateral backs every debt in the pool, so these headline values cannot
   * be derived from one market's balances. Null for isolated markets.
   */
  readonly poolAccountMetrics: NetMetrics | null;
  readonly risk: RiskPosition;
  readonly supplyBalances: ReadonlyArray<SupplyBalance>;
  readonly supplyPendingActions: ReadonlyArray<PendingAction>;
}): MarketPosition => {
  const totalSuppliedUsd = sumSupplyUsd(supplyBalances);
  const totalBorrowedUsd = debtBalance?.balanceUsd ?? exactZero();
  const { netApy, netWorthUsd } =
    poolAccountMetrics ??
    deriveMarketNetMetrics({
      debtBalance,
      supplyBalances,
      totalBorrowedUsd,
      totalSuppliedUsd,
    });

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
      netApy,
      netWorthUsd,
      totalBorrowedUsd,
      totalCollateralUsd: sumCollateralUsd(supplyBalances),
      totalSuppliedUsd,
    },
    risk,
  };
};
