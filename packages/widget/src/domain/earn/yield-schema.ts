import { Schema, Struct } from "effect";

import * as YieldApi from "../../generated/api/yield-schema";
import {
  OpenLiterals,
  TolerantArray,
  TolerantNullOr,
} from "../decoding/response-schema";
import { ExactDecimal, NonNegativeExactDecimal } from "../finance/scalars";
import { ContractAddress, ProviderId, YieldId } from "../identity/identifiers";
import { Token } from "../token/token";
import { EarnYieldArguments } from "./mechanic-arguments";
import { EarnProvider } from "./provider";
import { EarnRewardRate, TolerantExactDecimal } from "./wire-fields";

const EarnYieldTokens = TolerantArray(Token, { operation: "yield-tokens" });

// Only the metadata the widget reads is picked, so values the API adds to
// unread enums cannot reject an otherwise usable yield.
const EarnYieldMetadata = YieldApi.YieldMetadataDto.mapFields(
  Struct.pick(["name", "logoURI", "description", "documentation"])
);

const EarnYieldRequirements = Schema.Struct({
  ...Struct.pick(YieldApi.YieldRequirementsDto.fields, ["kycRequired"]),
  kyc: Schema.optionalKey(
    YieldApi.KycMetadataDto.mapFields(
      Struct.pick(["iframeAllowed", "authorizeUrl"])
    )
  ),
});

const EarnPricePerShareState = Schema.Struct({
  price: ExactDecimal,
  shareToken: Token,
});

const EarnCapacityState = Schema.Struct({
  current: NonNegativeExactDecimal,
  max: Schema.optionalKey(Schema.NullOr(NonNegativeExactDecimal)),
  remaining: Schema.optionalKey(Schema.NullOr(NonNegativeExactDecimal)),
});

// A malformed price-per-share state only drops share pricing.
const EarnYieldState = Schema.Struct({
  capacityState: Schema.optionalKey(
    TolerantNullOr(EarnCapacityState, {
      operation: "yield-state",
      field: "capacityState",
    })
  ),
  pricePerShareState: Schema.optionalKey(
    TolerantNullOr(EarnPricePerShareState, {
      operation: "yield-state",
      field: "pricePerShareState",
    })
  ),
});

// Only the statistics the widget reads are decoded; `tvlRaw` is unread.
// `tvl` is in the yield's token units, the units of its TVL history.
const EarnYieldStatistics = Schema.Struct({
  averagePositionSizeUsd: Schema.optionalKey(
    TolerantExactDecimal("yield-statistics", "averagePositionSizeUsd")
  ),
  tvl: Schema.optionalKey(TolerantExactDecimal("yield-statistics", "tvl")),
  tvlUsd: Schema.optionalKey(
    TolerantExactDecimal("yield-statistics", "tvlUsd")
  ),
});

// Fees are percentages; a malformed one drops only itself.
const EarnYieldFee = Schema.Struct({
  deposit: Schema.optionalKey(TolerantExactDecimal("yield-fee", "deposit")),
  management: Schema.optionalKey(
    TolerantExactDecimal("yield-fee", "management")
  ),
  performance: Schema.optionalKey(
    TolerantExactDecimal("yield-fee", "performance")
  ),
  withdrawal: Schema.optionalKey(
    TolerantExactDecimal("yield-fee", "withdrawal")
  ),
});

// Token-unit limits; a malformed limit reads as no limit.
const EarnYieldEntryLimits = Schema.Struct({
  maximum: TolerantExactDecimal("yield-entry-limits", "maximum"),
  minimum: TolerantExactDecimal("yield-entry-limits", "minimum"),
  subsequentMinimum: TolerantExactDecimal(
    "yield-entry-limits",
    "subsequentMinimum"
  ),
});

const EarnYieldRisk = Schema.Struct({
  ratings: Schema.Array(
    Schema.Struct({
      ...Struct.pick(YieldApi.YieldRiskEntryDto.fields, ["rating"]),
      source: Schema.String,
    })
  ),
});

const EarnScheduleWindow = Schema.Struct({
  closesAt: Schema.String,
  opensAt: Schema.String,
});

const EarnSchedulePath = Schema.Struct({
  ...Struct.pick(YieldApi.SchedulePathDto.fields, [
    "businessDaysOnly",
    "cutoffTime",
  ]),
  cadence: OpenLiterals(YieldApi.SchedulePathDto.fields.cadence),
  currentWindow: Schema.optionalKey(Schema.NullOr(EarnScheduleWindow)),
  nextWindow: Schema.optionalKey(Schema.NullOr(EarnScheduleWindow)),
  kind: OpenLiterals(YieldApi.SchedulePathDto.fields.kind),
  status: OpenLiterals(YieldApi.SchedulePathDto.fields.status),
});

const EarnScheduleSide = Schema.Struct({
  paths: Schema.Array(EarnSchedulePath),
});

const EarnInvestmentSchedule = Schema.Struct({
  redemption: EarnScheduleSide,
  subscription: EarnScheduleSide,
  timezone: Schema.String,
});
export type EarnInvestmentSchedule = typeof EarnInvestmentSchedule.Type;

/** The contracts a yield's enter and exit transactions call. */
const EarnExecutionContracts = Schema.Struct({
  enter: Schema.optionalKey(Schema.Array(ContractAddress)),
  exit: Schema.optionalKey(Schema.Array(ContractAddress)),
});

export const EarnYield = Schema.Struct({
  ...Struct.pick(YieldApi.YieldDto.fields, ["network", "status"]),
  statistics: Schema.optionalKey(EarnYieldStatistics),
  // Malformed contracts leave the yield non-confidential.
  executionContracts: Schema.optionalKey(
    TolerantNullOr(EarnExecutionContracts, {
      operation: "yield",
      field: "executionContracts",
    })
  ),
  id: YieldId,
  providerId: ProviderId,
  inputTokens: EarnYieldTokens,
  // A malformed schedule only drops batch timing.
  investmentSchedule: Schema.optionalKey(
    TolerantNullOr(EarnInvestmentSchedule, {
      operation: "yield",
      field: "investmentSchedule",
    })
  ),
  mechanics: Schema.Struct({
    ...Struct.pick(YieldApi.YieldMechanicsDto.fields, [
      "type",
      "requiresValidatorSelection",
      "rewardSchedule",
      "rewardClaiming",
      "lockupPeriod",
      "cooldownPeriod",
      "warmupPeriod",
    ]),
    entryLimits: Schema.optionalKey(EarnYieldEntryLimits),
    fee: Schema.optionalKey(EarnYieldFee),
    arguments: Schema.optionalKey(EarnYieldArguments),
    gasFeeToken: Token,
    requirements: Schema.optionalKey(EarnYieldRequirements),
  }),
  metadata: EarnYieldMetadata,
  outputToken: Schema.optionalKey(Token),
  rewardRate: EarnRewardRate,
  risk: Schema.optionalKey(EarnYieldRisk),
  state: Schema.optionalKey(EarnYieldState),
  token: Token,
  tokens: EarnYieldTokens,
});
export type EarnYield = typeof EarnYield.Type;

export const EarnYieldWithProvider = Schema.Struct({
  ...EarnYield.fields,
  provider: Schema.optionalKey(EarnProvider),
});
export type EarnYieldWithProvider = typeof EarnYieldWithProvider.Type;
