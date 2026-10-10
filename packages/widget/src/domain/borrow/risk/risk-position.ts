import { exactZero, sumExact } from "../../finance/exact";
import type { Market } from "../catalog/market";
import type {
  BorrowAccountSnapshot,
  DebtBalance,
  SupplyBalance,
} from "../positions/borrow-account-snapshot";
import {
  deriveOracleRiskAnchor,
  getCollateralState,
  getDefinitions,
  getIsolatedPositionState,
} from "./collateral-state";
import { deriveMarketRiskLimits } from "./market-risk";
import {
  collateralTotalMatchesSnapshot,
  makeAuthoritativeAccountCurrent,
  makeAuthoritativeMarketCurrent,
  makeLoanPrices,
  makeRiskPosition,
  projectState,
  type RiskPositionContract,
} from "./risk-assessment";
import { type RiskValuation, unavailable } from "./risk-model";

export type RiskPosition = RiskPositionContract;

const displayValuation: RiskValuation = { type: "display" };
const unanchoredValuation: RiskValuation = { type: "unanchored" };

export const makeAccountRiskPosition = ({
  markets,
  snapshot,
}: {
  readonly markets: ReadonlyArray<Market>;
  readonly snapshot: BorrowAccountSnapshot | null;
}): RiskPosition => {
  const definitionsResult = getDefinitions(markets);
  const totalCollateralUsd = snapshot?.totalCollateralUsd ?? exactZero();
  const totalDebtUsd = snapshot?.totalBorrowedUsd ?? exactZero();

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
      valuation: displayValuation,
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
      valuation: displayValuation,
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
      valuation: displayValuation,
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
    valuation: displayValuation,
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
  const totalCollateralUsd = sumExact(
    supplyBalances
      .filter((balance) => balance.isCollateral)
      .map((balance) => balance.balanceUsd)
  );
  const totalDebtUsd = debtBalance?.balanceUsd ?? exactZero();
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
      valuation: unanchoredValuation,
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
      valuation: unanchoredValuation,
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
      valuation: unanchoredValuation,
    });
  }
  const { positionState } = positionStateResult;
  const hasExposure =
    supplyBalances.some((supplyBalance) =>
      supplyBalance.balance.isGreaterThan(0)
    ) ||
    (debtBalance?.balance.isGreaterThan(0) ?? false);
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

    return local.status === "available"
      ? { ...local, maxLtv: deriveMarketRiskLimits(market).maxLtv }
      : local;
  })();
  const anchor = positionState
    ? deriveOracleRiskAnchor({
        debtBalance,
        market,
        positionState,
        supplyBalances,
      })
    : null;

  return makeRiskPosition({
    current,
    definitions: definitionsResult.definitions,
    loanPrices,
    scope: "market",
    state,
    valuation: anchor ? { anchor, type: "oracle" } : unanchoredValuation,
  });
};
