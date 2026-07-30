import type { Market } from "../catalog/market";
import type {
  BorrowAccountSnapshot,
  DebtBalance,
  SupplyBalance,
} from "../positions/borrow-account-snapshot";
import {
  getCollateralState,
  getDefinitions,
  getIsolatedPositionState,
} from "./collateral-state";
import {
  makeLoanPrices,
  makeRiskPosition,
  type RiskPositionContract,
} from "./risk-assessment";
import { unavailable } from "./risk-model";
import {
  collateralTotalMatchesSnapshot,
  makeAuthoritativeAccountCurrent,
  makeAuthoritativeMarketCurrent,
  projectState,
} from "./risk-projection";

export type RiskPosition = RiskPositionContract;

export const makeAccountRiskPosition = ({
  markets,
  snapshot,
}: {
  readonly markets: ReadonlyArray<Market>;
  readonly snapshot: BorrowAccountSnapshot | null;
}): RiskPosition => {
  const definitionsResult = getDefinitions(markets);
  const totalCollateralUsd = snapshot?.totalCollateralUsd ?? 0;
  const totalDebtUsd = snapshot?.totalBorrowedUsd ?? 0;

  if (definitionsResult.status === "unavailable") {
    return makeRiskPosition({
      current: unavailable({
        reason: definitionsResult.reason,
        totalCollateralUsd,
        totalDebtUsd,
      }),
      definitions: new Map(),
      loanPrices: makeLoanPrices(markets),
      scope: "account",
      state: { collateral: [], debtUsd: totalDebtUsd },
    });
  }

  const collateralResult = getCollateralState({
    definitions: definitionsResult.definitions,
    supplyBalances: snapshot?.supplyBalances ?? [],
  });
  if (collateralResult.status === "unavailable") {
    return makeRiskPosition({
      current: unavailable({
        reason: collateralResult.reason,
        totalCollateralUsd,
        totalDebtUsd,
      }),
      definitions: definitionsResult.definitions,
      loanPrices: makeLoanPrices(markets),
      scope: "account",
      state: { collateral: [], debtUsd: totalDebtUsd },
    });
  }

  const state = {
    collateral: collateralResult.collateral,
    debtUsd: totalDebtUsd,
  };
  const local = projectState(state);
  if (
    snapshot &&
    local.status === "available" &&
    !collateralTotalMatchesSnapshot({
      compositionTotalUsd: local.totalCollateralUsd,
      snapshotTotalUsd: snapshot.totalCollateralUsd,
    })
  ) {
    return makeRiskPosition({
      current: unavailable({
        reason: "conflictingCollateralTotal",
        totalCollateralUsd,
        totalDebtUsd,
      }),
      definitions: definitionsResult.definitions,
      loanPrices: makeLoanPrices(markets),
      scope: "account",
      state,
    });
  }
  const current =
    snapshot && local.status === "available"
      ? makeAuthoritativeAccountCurrent({ local, snapshot })
      : local;

  return makeRiskPosition({
    current,
    definitions: definitionsResult.definitions,
    loanPrices: makeLoanPrices(markets),
    scope: "account",
    state,
  });
};

export const makeMarketRiskPosition = ({
  debtBalance,
  market,
  supplyBalances,
}: {
  readonly debtBalance: DebtBalance | null;
  readonly market: Market;
  readonly supplyBalances: ReadonlyArray<SupplyBalance>;
}): RiskPosition => {
  const definitionsResult = getDefinitions([market]);
  const totalCollateralUsd = supplyBalances
    .filter((balance) => balance.isCollateral)
    .reduce((total, balance) => total + balance.balanceUsd, 0);
  const totalDebtUsd = debtBalance?.balanceUsd ?? 0;
  const loanPrices = makeLoanPrices([market]);

  if (definitionsResult.status === "unavailable") {
    return makeRiskPosition({
      current: unavailable({
        reason: definitionsResult.reason,
        totalCollateralUsd,
        totalDebtUsd,
      }),
      definitions: new Map(),
      loanPrices,
      scope: "market",
      state: { collateral: [], debtUsd: totalDebtUsd },
    });
  }

  const collateralResult = getCollateralState({
    definitions: definitionsResult.definitions,
    supplyBalances,
  });
  if (collateralResult.status === "unavailable") {
    return makeRiskPosition({
      current: unavailable({
        reason: collateralResult.reason,
        totalCollateralUsd,
        totalDebtUsd,
      }),
      definitions: definitionsResult.definitions,
      loanPrices,
      scope: "market",
      state: { collateral: [], debtUsd: totalDebtUsd },
    });
  }

  const state = {
    collateral: collateralResult.collateral,
    debtUsd: totalDebtUsd,
  };
  const local = projectState(state);
  const positionStateResult = getIsolatedPositionState(supplyBalances);
  if (positionStateResult.status === "unavailable") {
    return makeRiskPosition({
      current: unavailable({
        reason: positionStateResult.reason,
        totalCollateralUsd,
        totalDebtUsd,
      }),
      definitions: definitionsResult.definitions,
      loanPrices,
      scope: "market",
      state,
    });
  }
  const { positionState } = positionStateResult;
  const hasExposure =
    supplyBalances.some((supplyBalance) => supplyBalance.balance > 0) ||
    (debtBalance?.balance ?? 0) > 0;
  const current = (() => {
    if (local.status === "available" && positionState) {
      return makeAuthoritativeMarketCurrent({ local, positionState });
    }

    if (hasExposure && !positionState) {
      return unavailable({
        reason: "missingPositionState",
        totalCollateralUsd,
        totalDebtUsd,
      });
    }

    return local;
  })();

  return makeRiskPosition({
    current,
    definitions: definitionsResult.definitions,
    loanPrices,
    scope: "market",
    state,
  });
};
