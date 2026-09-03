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
  type RiskAssessment,
  type RiskChange,
  type RiskProjection,
  type RiskState,
  type RiskStateResult,
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
}: {
  readonly current: RiskProjection;
  readonly definitions: ReadonlyMap<TokenId, CollateralDefinition>;
  readonly loanPrices: ReadonlyMap<MarketId, BigNumber>;
  readonly scope: RiskPositionContract["scope"];
  readonly state: RiskState;
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

    const baseline = projectExactRiskTotals(state);
    const projectedTotals = projectExactRiskTotals(changed.state);
    const projection = projectState(changed.state);
    const riskIncreasing =
      changed.state.debtUsd.isGreaterThan(state.debtUsd) ||
      projectedTotals.borrowCapacityUsd.isLessThan(baseline.borrowCapacityUsd);

    return projection.status === "available" &&
      riskIncreasing &&
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
    maxLtv: snapshot.totalCollateralUsd.isGreaterThan(0)
      ? borrowCapacityUsd.dividedBy(snapshot.totalCollateralUsd)
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
    maxLtv: local.totalCollateralUsd.isGreaterThan(0)
      ? borrowCapacityUsd.dividedBy(local.totalCollateralUsd)
      : null,
  };
};
