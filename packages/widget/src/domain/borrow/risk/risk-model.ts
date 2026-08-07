import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { MarketId, TokenId } from "../ids";

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

const NonNegativeDecimal = Schema.instanceOf(BigNumber).check(
  Schema.makeFilter((amount) =>
    amount.isFinite() && amount.isGreaterThanOrEqualTo(0)
      ? true
      : "expected a finite non-negative decimal"
  )
);

const RiskChangeSchema = Schema.Union([
  Schema.Struct({
    amount: NonNegativeDecimal,
    marketId: MarketId,
    type: Schema.Literals(["borrow", "repay"]),
  }),
  Schema.Struct({
    amount: NonNegativeDecimal,
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
  readonly liquidationThreshold: BigNumber;
  readonly maxLtv: BigNumber;
  readonly priceUsd: BigNumber;
  readonly tokenId: TokenId;
};

export type CollateralExposure = CollateralDefinition & {
  readonly collateralUsd: BigNumber;
  readonly enabled: boolean;
};

export type RiskState = {
  readonly collateral: ReadonlyArray<CollateralExposure>;
  readonly debtUsd: BigNumber;
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
