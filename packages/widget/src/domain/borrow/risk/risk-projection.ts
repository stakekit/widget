import type {
  BorrowAccountSnapshot,
  IsolatedRiskSnapshot,
} from "../positions/borrow-account-snapshot";
import {
  type AvailableRiskProjection,
  decodeRiskAmount,
  hasInvalidRiskAmounts,
  type RiskProjection,
  type RiskState,
  unavailable,
} from "./risk-model";

export const projectState = (state: RiskState): RiskProjection => {
  const enabledCollateral = state.collateral.filter((item) => item.enabled);
  const totals = enabledCollateral.reduce(
    (result, item) => ({
      borrowCapacityUsd:
        result.borrowCapacityUsd + item.collateralUsd * item.maxLtv,
      liquidationCapacityUsd:
        result.liquidationCapacityUsd +
        item.collateralUsd * item.liquidationThreshold,
      totalCollateralUsd: result.totalCollateralUsd + item.collateralUsd,
    }),
    {
      borrowCapacityUsd: 0,
      liquidationCapacityUsd: 0,
      totalCollateralUsd: 0,
    }
  );

  if (
    hasInvalidRiskAmounts([
      decodeRiskAmount(totals.borrowCapacityUsd),
      decodeRiskAmount(totals.liquidationCapacityUsd),
      decodeRiskAmount(totals.totalCollateralUsd),
      decodeRiskAmount(state.debtUsd),
    ])
  ) {
    return unavailable({
      reason: "invalidAmount",
      totalCollateralUsd: null,
      totalDebtUsd: null,
    });
  }

  const hasCollateral = totals.totalCollateralUsd > 0;
  const ltv = (() => {
    if (hasCollateral) {
      return state.debtUsd / totals.totalCollateralUsd;
    }

    return state.debtUsd > 0 ? 1 : 0;
  })();

  return {
    ...totals,
    healthFactor:
      state.debtUsd > 0 ? totals.liquidationCapacityUsd / state.debtUsd : null,
    liquidationThreshold: hasCollateral
      ? totals.liquidationCapacityUsd / totals.totalCollateralUsd
      : null,
    ltv,
    maxLtv: hasCollateral
      ? totals.borrowCapacityUsd / totals.totalCollateralUsd
      : null,
    status: "available",
    totalDebtUsd: state.debtUsd,
  };
};

export const collateralTotalMatchesSnapshot = ({
  compositionTotalUsd,
  snapshotTotalUsd,
}: {
  readonly compositionTotalUsd: number;
  readonly snapshotTotalUsd: number;
}) => {
  const tolerance = Math.max(0.01, snapshotTotalUsd * 0.000_001);

  return Math.abs(compositionTotalUsd - snapshotTotalUsd) <= tolerance;
};

export const makeAuthoritativeAccountCurrent = ({
  local,
  snapshot,
}: {
  readonly local: AvailableRiskProjection;
  readonly snapshot: BorrowAccountSnapshot;
}): AvailableRiskProjection => {
  const borrowCapacityUsd =
    snapshot.availableToBorrowUsd == null
      ? local.borrowCapacityUsd
      : snapshot.totalBorrowedUsd + snapshot.availableToBorrowUsd;
  const liquidationCapacityUsd =
    snapshot.healthFactor == null || snapshot.totalBorrowedUsd === 0
      ? local.liquidationCapacityUsd
      : snapshot.healthFactor * snapshot.totalBorrowedUsd;

  return {
    borrowCapacityUsd,
    healthFactor: snapshot.healthFactor,
    liquidationCapacityUsd,
    liquidationThreshold:
      snapshot.totalCollateralUsd > 0
        ? liquidationCapacityUsd / snapshot.totalCollateralUsd
        : null,
    ltv: snapshot.currentLtv,
    maxLtv:
      snapshot.totalCollateralUsd > 0
        ? borrowCapacityUsd / snapshot.totalCollateralUsd
        : null,
    status: "available",
    totalCollateralUsd: snapshot.totalCollateralUsd,
    totalDebtUsd: snapshot.totalBorrowedUsd,
  };
};

export const makeAuthoritativeMarketCurrent = ({
  local,
  positionState,
}: {
  readonly local: AvailableRiskProjection;
  readonly positionState: IsolatedRiskSnapshot;
}): AvailableRiskProjection => {
  const borrowCapacityUsd =
    local.totalDebtUsd + positionState.availableToBorrowUsd;
  const liquidationCapacityUsd =
    positionState.healthFactor == null || local.totalDebtUsd === 0
      ? local.liquidationCapacityUsd
      : positionState.healthFactor * local.totalDebtUsd;

  return {
    ...local,
    borrowCapacityUsd,
    healthFactor: positionState.healthFactor,
    liquidationCapacityUsd,
    liquidationThreshold: positionState.liquidationThreshold,
    ltv: positionState.currentLtv,
    maxLtv:
      local.totalCollateralUsd > 0
        ? borrowCapacityUsd / local.totalCollateralUsd
        : null,
  };
};
