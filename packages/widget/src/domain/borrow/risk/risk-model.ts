import { Option, Schema } from "effect";
import { MarketId, TokenId } from "../ids";
import { NonNegativeFinite } from "./risk-values";

export type RiskUnavailableReason =
  | "conflictingParameters"
  | "conflictingCollateralTotal"
  | "conflictingPositionState"
  | "invalidAmount"
  | "missingParameters"
  | "missingPositionState"
  | "missingPrice"
  | "unknownCollateral"
  | "unknownMarket";

export type AvailableRiskProjection = {
  readonly borrowCapacityUsd: number;
  readonly healthFactor: number | null;
  readonly liquidationCapacityUsd: number;
  readonly liquidationThreshold: number | null;
  readonly ltv: number;
  readonly maxLtv: number | null;
  readonly status: "available";
  readonly totalCollateralUsd: number;
  readonly totalDebtUsd: number;
};

type UnavailableRiskProjection = {
  readonly reason: RiskUnavailableReason;
  readonly status: "unavailable";
  readonly totalCollateralUsd: number | null;
  readonly totalDebtUsd: number | null;
};

export type RiskProjection =
  | AvailableRiskProjection
  | UnavailableRiskProjection;

const RiskChangeSchema = Schema.Union([
  Schema.Struct({
    amount: NonNegativeFinite,
    marketId: MarketId,
    type: Schema.Literals(["borrow", "repay"]),
  }),
  Schema.Struct({
    amount: NonNegativeFinite,
    tokenId: TokenId,
    type: Schema.Literals(["supply", "withdraw"]),
  }),
  Schema.Struct({
    tokenId: TokenId,
    type: Schema.Literals(["disableCollateral", "enableCollateral"]),
  }),
]);

export type RiskChange = typeof RiskChangeSchema.Type;

export type RiskAssessment =
  | {
      readonly decision: "allow";
      readonly projection: RiskProjection;
    }
  | {
      readonly decision: "block";
      readonly projection: AvailableRiskProjection;
      readonly reason: "borrowCapacityExceeded";
    };

export type CollateralDefinition = {
  readonly liquidationThreshold: number;
  readonly maxLtv: number;
  readonly priceUsd: number;
  readonly tokenId: TokenId;
};

export type CollateralExposure = CollateralDefinition & {
  readonly collateralUsd: number;
  readonly enabled: boolean;
};

export type RiskState = {
  readonly collateral: ReadonlyArray<CollateralExposure>;
  readonly debtUsd: number;
};

export type RiskStateResult =
  | {
      readonly state: RiskState;
      readonly status: "available";
    }
  | {
      readonly reason: RiskUnavailableReason;
      readonly status: "unavailable";
    };

export const decodeChanges = Schema.decodeUnknownOption(
  Schema.Array(RiskChangeSchema)
);
export const decodeRiskAmount = Schema.decodeUnknownOption(NonNegativeFinite);

export const unavailable = ({
  reason,
  totalCollateralUsd,
  totalDebtUsd,
}: {
  readonly reason: RiskUnavailableReason;
  readonly totalCollateralUsd: number | null;
  readonly totalDebtUsd: number | null;
}): UnavailableRiskProjection => ({
  reason,
  status: "unavailable",
  totalCollateralUsd,
  totalDebtUsd,
});

export const hasInvalidRiskAmounts = (
  amounts: ReadonlyArray<Option.Option<number>>
) => amounts.some(Option.isNone);
