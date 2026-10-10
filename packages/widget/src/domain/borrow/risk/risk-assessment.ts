import BigNumber from "bignumber.js";
import { Option } from "effect";
import { exactDecimal, exactZero } from "../../finance/exact";
import type { Market } from "../catalog/market";
import type { MarketId, TokenId } from "../ids";
import type {
  BorrowAccountSnapshot,
  IsolatedRiskSnapshot,
} from "../positions/borrow-account-snapshot";
import {
  type AvailableRiskProjection,
  type CollateralDefinition,
  decodeChanges,
  type OracleRiskAnchor,
  type RiskAssessment,
  type RiskChange,
  type RiskProjection,
  type RiskState,
  type RiskStateResult,
  type RiskUnavailableReason,
  type RiskValuation,
  unavailable,
} from "./risk-model";

type ExactRiskTotals = {
  readonly borrowCapacityUsd: BigNumber;
  readonly liquidationCapacityUsd: BigNumber;
  readonly totalCollateralUsd: BigNumber;
};

const projectExactRiskTotals = (state: RiskState): ExactRiskTotals => {
  const enabledCollateral = state.collateral.filter((item) => item.enabled);
  return enabledCollateral.reduce<ExactRiskTotals>(
    (result, item) => ({
      borrowCapacityUsd: result.borrowCapacityUsd.plus(
        item.collateralUsd.multipliedBy(item.maxLtv)
      ),
      liquidationCapacityUsd: result.liquidationCapacityUsd.plus(
        item.collateralUsd.multipliedBy(item.liquidationThreshold)
      ),
      totalCollateralUsd: result.totalCollateralUsd.plus(item.collateralUsd),
    }),
    {
      borrowCapacityUsd: exactZero(),
      liquidationCapacityUsd: exactZero(),
      totalCollateralUsd: exactZero(),
    }
  );
};

export const projectState = (state: RiskState): RiskProjection => {
  const totals = projectExactRiskTotals(state);
  const hasCollateral = totals.totalCollateralUsd.isGreaterThan(0);
  const ltv = (() => {
    if (hasCollateral) {
      return state.debtUsd.dividedBy(totals.totalCollateralUsd);
    }

    return state.debtUsd.isGreaterThan(0) ? exactDecimal(1) : exactZero();
  })();

  return {
    borrowCapacityUsd: totals.borrowCapacityUsd,
    healthFactor: state.debtUsd.isGreaterThan(0)
      ? totals.liquidationCapacityUsd.dividedBy(state.debtUsd)
      : null,
    liquidationCapacityUsd: totals.liquidationCapacityUsd,
    liquidationThreshold: hasCollateral
      ? totals.liquidationCapacityUsd.dividedBy(totals.totalCollateralUsd)
      : null,
    ltv,
    maxLtv: hasCollateral
      ? totals.borrowCapacityUsd.dividedBy(totals.totalCollateralUsd)
      : null,
    status: "available",
    totalCollateralUsd: totals.totalCollateralUsd,
    totalDebtUsd: state.debtUsd,
  };
};

const applyChange = ({
  change,
  collateralDefinitions,
  loanPrices,
  state,
}: {
  readonly change: RiskChange;
  readonly collateralDefinitions: ReadonlyMap<TokenId, CollateralDefinition>;
  readonly loanPrices: ReadonlyMap<MarketId, BigNumber>;
  readonly state: RiskState;
}): RiskStateResult => {
  switch (change.type) {
    case "borrow":
    case "repay": {
      const priceUsd = loanPrices.get(change.marketId);
      if (priceUsd == null) {
        return { reason: "unknownMarket", status: "unavailable" };
      }
      if (priceUsd.isLessThanOrEqualTo(0)) {
        return { reason: "missingPrice", status: "unavailable" };
      }
      const debtUsdChange = change.amount.multipliedBy(priceUsd);

      return {
        state: {
          ...state,
          debtUsd:
            change.type === "borrow"
              ? state.debtUsd.plus(debtUsdChange)
              : BigNumber.maximum(state.debtUsd.minus(debtUsdChange), 0),
        },
        status: "available",
      };
    }
    case "supply":
    case "withdraw": {
      const definition = collateralDefinitions.get(change.tokenId);
      if (!definition) {
        return { reason: "unknownCollateral", status: "unavailable" };
      }
      if (definition.priceUsd.isLessThanOrEqualTo(0)) {
        return { reason: "missingPrice", status: "unavailable" };
      }
      const collateralUsdChange = change.amount.multipliedBy(
        definition.priceUsd
      );
      const existing = state.collateral.find(
        (item) => item.tokenId === change.tokenId
      );

      if (!existing && change.type === "withdraw") {
        return { reason: "unknownCollateral", status: "unavailable" };
      }

      if (!existing) {
        return {
          state: {
            ...state,
            collateral: [
              ...state.collateral,
              {
                ...definition,
                collateralUsd: collateralUsdChange,
                enabled: true,
              },
            ],
          },
          status: "available",
        };
      }

      const collateralUsd =
        change.type === "supply"
          ? existing.collateralUsd.plus(collateralUsdChange)
          : BigNumber.maximum(
              existing.collateralUsd.minus(collateralUsdChange),
              0
            );

      return {
        state: {
          ...state,
          collateral: state.collateral.map((item) =>
            item.tokenId === change.tokenId ? { ...item, collateralUsd } : item
          ),
        },
        status: "available",
      };
    }
    case "disableCollateral":
    case "enableCollateral": {
      const existing = state.collateral.find(
        (item) => item.tokenId === change.tokenId
      );
      if (!existing) {
        return { reason: "unknownCollateral", status: "unavailable" };
      }

      return {
        state: {
          ...state,
          collateral: state.collateral.map((item) =>
            item.tokenId === change.tokenId
              ? {
                  ...item,
                  enabled: change.type === "enableCollateral",
                }
              : item
          ),
        },
        status: "available",
      };
    }
  }
};

const applyChanges = ({
  changes,
  collateralDefinitions,
  loanPrices,
  state,
}: {
  readonly changes: ReadonlyArray<RiskChange>;
  readonly collateralDefinitions: ReadonlyMap<TokenId, CollateralDefinition>;
  readonly loanPrices: ReadonlyMap<MarketId, BigNumber>;
  readonly state: RiskState;
}): RiskStateResult =>
  changes.reduce<RiskStateResult>(
    (result, change) => {
      if (result.status === "unavailable") {
        return result;
      }

      return applyChange({
        change,
        collateralDefinitions,
        loanPrices,
        state: result.state,
      });
    },
    {
      state,
      status: "available",
    }
  );

type OracleRiskState = {
  readonly collateralAmount: BigNumber;
  readonly collateralEnabled: boolean;
  readonly debtAmount: BigNumber;
};

type OracleRiskStateResult =
  | { readonly state: OracleRiskState; readonly status: "available" }
  | { readonly reason: RiskUnavailableReason; readonly status: "unavailable" };

const applyOracleChange = ({
  anchor,
  change,
  state,
}: {
  readonly anchor: OracleRiskAnchor;
  readonly change: RiskChange;
  readonly state: OracleRiskState;
}): OracleRiskStateResult => {
  switch (change.type) {
    case "borrow":
    case "repay": {
      if (change.marketId !== anchor.marketId) {
        return { reason: "unknownMarket", status: "unavailable" };
      }

      return {
        state: {
          ...state,
          debtAmount:
            change.type === "borrow"
              ? state.debtAmount.plus(change.amount)
              : BigNumber.maximum(state.debtAmount.minus(change.amount), 0),
        },
        status: "available",
      };
    }
    case "supply":
    case "withdraw": {
      if (change.tokenId !== anchor.collateralTokenId) {
        return { reason: "unknownCollateral", status: "unavailable" };
      }

      return {
        state: {
          ...state,
          collateralAmount:
            change.type === "supply"
              ? state.collateralAmount.plus(change.amount)
              : BigNumber.maximum(
                  state.collateralAmount.minus(change.amount),
                  0
                ),
        },
        status: "available",
      };
    }
    case "disableCollateral":
    case "enableCollateral": {
      if (change.tokenId !== anchor.collateralTokenId) {
        return { reason: "unknownCollateral", status: "unavailable" };
      }

      return {
        state: {
          ...state,
          collateralEnabled: change.type === "enableCollateral",
        },
        status: "available",
      };
    }
  }
};

/** Collateral value in loan-token units at the anchored oracle price. */
const oracleCollateralValue = ({
  anchor,
  state,
}: {
  readonly anchor: OracleRiskAnchor;
  readonly state: OracleRiskState;
}) =>
  state.collateralEnabled
    ? anchor.oraclePrice.multipliedBy(state.collateralAmount)
    : exactZero();

const assessOracle = ({
  anchor,
  changes,
  displayState,
}: {
  readonly anchor: OracleRiskAnchor;
  readonly changes: ReadonlyArray<RiskChange>;
  readonly displayState: RiskState;
}): RiskAssessment => {
  const baseline: OracleRiskState = {
    collateralAmount: anchor.collateralAmount,
    collateralEnabled: true,
    debtAmount: anchor.debtAmount,
  };
  const changed = changes.reduce<OracleRiskStateResult>(
    (result, change) =>
      result.status === "unavailable"
        ? result
        : applyOracleChange({ anchor, change, state: result.state }),
    { state: baseline, status: "available" }
  );
  if (changed.status === "unavailable") {
    return {
      decision: "allow",
      projection: unavailable({
        reason: changed.reason,
        totalCollateralUsd: null,
        totalDebtUsd: null,
      }),
    };
  }

  const { debtAmount } = changed.state;
  const collateralValue = oracleCollateralValue({
    anchor,
    state: changed.state,
  });
  const liquidationCapacity = collateralValue.multipliedBy(
    anchor.liquidationThreshold
  );
  const liquidationCapacityUsd = liquidationCapacity.multipliedBy(
    anchor.loanPriceUsd
  );
  const ltv = (() => {
    if (collateralValue.isGreaterThan(0)) {
      return debtAmount.dividedBy(collateralValue);
    }

    return debtAmount.isGreaterThan(0) ? exactDecimal(1) : exactZero();
  })();
  const projection: AvailableRiskProjection = {
    borrowCapacityUsd: liquidationCapacityUsd,
    healthFactor: debtAmount.isGreaterThan(0)
      ? liquidationCapacity.dividedBy(debtAmount)
      : null,
    liquidationCapacityUsd,
    liquidationThreshold: anchor.liquidationThreshold,
    ltv,
    maxLtv: anchor.liquidationThreshold,
    status: "available",
    totalCollateralUsd: projectExactRiskTotals(displayState).totalCollateralUsd,
    totalDebtUsd: displayState.debtUsd,
  };
  const riskIncreasing =
    debtAmount.isGreaterThan(baseline.debtAmount) ||
    collateralValue.isLessThan(
      oracleCollateralValue({ anchor, state: baseline })
    );

  return riskIncreasing && debtAmount.isGreaterThan(liquidationCapacity)
    ? { decision: "block", projection, reason: "borrowCapacityExceeded" }
    : { decision: "allow", projection };
};

export type RiskPositionContract = {
  readonly assess: (changes: ReadonlyArray<RiskChange>) => RiskAssessment;
  readonly current: RiskProjection;
  readonly scope: "account" | "market";
};

export const makeRiskPosition = ({
  current,
  definitions,
  loanPrices,
  scope,
  state,
  valuation,
}: {
  readonly current: RiskProjection;
  readonly definitions: ReadonlyMap<TokenId, CollateralDefinition>;
  readonly loanPrices: ReadonlyMap<MarketId, BigNumber>;
  readonly scope: RiskPositionContract["scope"];
  readonly state: RiskState;
  readonly valuation: RiskValuation;
}): RiskPositionContract => ({
  assess: (changes) => {
    const decodedChanges = decodeChanges(changes);
    if (Option.isNone(decodedChanges)) {
      return {
        decision: "allow",
        projection: unavailable({
          reason: "invalidAmount",
          totalCollateralUsd: current.totalCollateralUsd,
          totalDebtUsd: current.totalDebtUsd,
        }),
      };
    }

    if (current.status === "unavailable") {
      return {
        decision: "allow",
        projection: current,
      };
    }

    const changed = applyChanges({
      changes,
      collateralDefinitions: definitions,
      loanPrices,
      state,
    });
    if (changed.status === "unavailable") {
      return {
        decision: "allow",
        projection: unavailable({
          reason: changed.reason,
          totalCollateralUsd: null,
          totalDebtUsd: null,
        }),
      };
    }

    if (valuation.type === "oracle") {
      return assessOracle({
        anchor: valuation.anchor,
        changes,
        displayState: changed.state,
      });
    }

    const baseline = projectExactRiskTotals(state);
    const projectedTotals = projectExactRiskTotals(changed.state);
    // Without an oracle anchor, display prices only guard capacity; they
    // never stand in for the protocol's projected LTV or health factor.
    const projection =
      valuation.type === "display"
        ? projectState(changed.state)
        : unavailable({
            reason: "missingRiskAnchor",
            totalCollateralUsd: projectedTotals.totalCollateralUsd,
            totalDebtUsd: changed.state.debtUsd,
          });
    const riskIncreasing =
      changed.state.debtUsd.isGreaterThan(state.debtUsd) ||
      projectedTotals.borrowCapacityUsd.isLessThan(baseline.borrowCapacityUsd);

    return riskIncreasing &&
      changed.state.debtUsd.isGreaterThan(projectedTotals.borrowCapacityUsd)
      ? {
          decision: "block",
          projection,
          reason: "borrowCapacityExceeded",
        }
      : { decision: "allow", projection };
  },
  current,
  scope,
});

export const makeLoanPrices = (markets: ReadonlyArray<Market>) =>
  new Map(markets.map((market) => [market.id, market.loanTokenPriceUsd]));

export const collateralTotalMatchesSnapshot = ({
  compositionTotalUsd,
  snapshotTotalUsd,
}: {
  readonly compositionTotalUsd: BigNumber;
  readonly snapshotTotalUsd: BigNumber;
}) => {
  const tolerance = BigNumber.max(
    exactDecimal("0.01"),
    snapshotTotalUsd.multipliedBy("0.000001")
  );

  return compositionTotalUsd
    .minus(snapshotTotalUsd)
    .abs()
    .isLessThanOrEqualTo(tolerance);
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
      : snapshot.totalBorrowedUsd.plus(snapshot.availableToBorrowUsd);
  const liquidationCapacityUsd =
    snapshot.healthFactor == null || snapshot.totalBorrowedUsd.isZero()
      ? local.liquidationCapacityUsd
      : snapshot.healthFactor.multipliedBy(snapshot.totalBorrowedUsd);

  return {
    borrowCapacityUsd,
    healthFactor: snapshot.healthFactor,
    liquidationCapacityUsd,
    liquidationThreshold: snapshot.totalCollateralUsd.isGreaterThan(0)
      ? liquidationCapacityUsd.dividedBy(snapshot.totalCollateralUsd)
      : null,
    ltv: snapshot.currentLtv,
    maxLtv: local.maxLtv,
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
  const borrowCapacityUsd = local.totalDebtUsd.plus(
    positionState.availableToBorrowUsd
  );
  const liquidationCapacityUsd =
    positionState.healthFactor == null || local.totalDebtUsd.isZero()
      ? local.liquidationCapacityUsd
      : positionState.healthFactor.multipliedBy(local.totalDebtUsd);

  return {
    ...local,
    borrowCapacityUsd,
    healthFactor: positionState.healthFactor,
    liquidationCapacityUsd,
    liquidationThreshold: positionState.liquidationThreshold,
    ltv: positionState.currentLtv,
    maxLtv: positionState.liquidationThreshold,
  };
};
