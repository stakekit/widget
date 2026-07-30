import { Option } from "effect";
import type { Market } from "../catalog/market";
import type { MarketId, TokenId } from "../ids";
import {
  type CollateralDefinition,
  decodeChanges,
  type RiskAssessment,
  type RiskChange,
  type RiskProjection,
  type RiskState,
  type RiskStateResult,
  unavailable,
} from "./risk-model";
import { projectState } from "./risk-projection";

const applyChange = ({
  change,
  collateralDefinitions,
  loanPrices,
  state,
}: {
  readonly change: RiskChange;
  readonly collateralDefinitions: ReadonlyMap<TokenId, CollateralDefinition>;
  readonly loanPrices: ReadonlyMap<MarketId, number>;
  readonly state: RiskState;
}): RiskStateResult => {
  switch (change.type) {
    case "borrow":
    case "repay": {
      const priceUsd = loanPrices.get(change.marketId);
      if (priceUsd == null) {
        return { reason: "unknownMarket", status: "unavailable" };
      }
      if (priceUsd <= 0) {
        return { reason: "missingPrice", status: "unavailable" };
      }
      const debtUsdChange = change.amount * priceUsd;

      return {
        state: {
          ...state,
          debtUsd:
            change.type === "borrow"
              ? state.debtUsd + debtUsdChange
              : Math.max(state.debtUsd - debtUsdChange, 0),
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
      if (definition.priceUsd <= 0) {
        return { reason: "missingPrice", status: "unavailable" };
      }
      const collateralUsdChange = change.amount * definition.priceUsd;
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
          ? existing.collateralUsd + collateralUsdChange
          : Math.max(existing.collateralUsd - collateralUsdChange, 0);

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
  readonly loanPrices: ReadonlyMap<MarketId, number>;
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
  readonly loanPrices: ReadonlyMap<MarketId, number>;
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

    const baseline = projectState(state);
    const projection = projectState(changed.state);
    const riskIncreasing =
      baseline.status === "available" &&
      projection.status === "available" &&
      (projection.totalDebtUsd > baseline.totalDebtUsd ||
        projection.borrowCapacityUsd < baseline.borrowCapacityUsd);

    return projection.status === "available" &&
      riskIncreasing &&
      projection.totalDebtUsd > projection.borrowCapacityUsd
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
