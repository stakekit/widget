import { Schema, SchemaTransformation } from "effect";
import * as LegacyApi from "../../generated/api/legacy-schema";
import * as YieldApi from "../../generated/api/yield-schema";
import { AdditionalAddresses } from "./address-models";
import { TokenAddress, WalletAddress, YieldId } from "./identifiers";
import { Network } from "./network-model";
import { TolerantTopLevelArray, TolerantTopLevelRecord } from "./response";
import { ValidDateFromString } from "./scalars";

export const KycStatus = YieldApi.KycStatusResponseDto;
export type KycStatus = typeof KycStatus.Type;

export const HistoryPeriod = Schema.Literals(["30d", "90d", "1y", "all"]);
export type HistoryPeriod = typeof HistoryPeriod.Type;

export const HistoryPoint = Schema.Struct({
  date: Schema.DateValid,
  timestamp: Schema.String,
  value: Schema.Number.check(Schema.isFinite()),
});
export type HistoryPoint = typeof HistoryPoint.Type;

const RewardRatePoint = YieldApi.RewardRateSnapshotDto.pipe(
  Schema.decodeTo(
    HistoryPoint,
    SchemaTransformation.transform({
      decode: (item): HistoryPoint => ({
        date: new Date(item.timestamp),
        timestamp: item.timestamp,
        value: Number(item.rewardRate) * 100,
      }),
      encode: (point: HistoryPoint) => ({
        rewardRate: String(point.value / 100),
        timestamp: point.timestamp,
      }),
    })
  )
);

const TvlPointWire = Schema.Struct({
  timestamp: Schema.String,
  tvl: Schema.optionalKey(Schema.NullOr(Schema.String)),
  tvlUsd: Schema.optionalKey(Schema.NullOr(Schema.FiniteFromString)),
});

const TvlPoint = TvlPointWire.pipe(
  Schema.decodeTo(
    HistoryPoint,
    SchemaTransformation.transform({
      decode: (item): HistoryPoint => ({
        date: new Date(item.timestamp),
        timestamp: item.timestamp,
        value: item.tvlUsd ?? Number.NaN,
      }),
      encode: (
        point: HistoryPoint
      ): {
        readonly timestamp: string;
        readonly tvl?: string | null;
        readonly tvlUsd?: number | null;
      } => ({ timestamp: point.timestamp, tvlUsd: point.value }),
    })
  )
);

const ValidHistoryPoint = HistoryPoint.check(
  Schema.makeFilter(
    (point) =>
      !Number.isNaN(point.date.getTime()) && Number.isFinite(point.value),
    { expected: "a finite history point with a valid timestamp" }
  )
);

export const RewardRateHistoryResponse = Schema.Struct({
  ...YieldApi.RewardRateHistoryResponseDto.fields,
  yieldId: YieldId,
  from: ValidDateFromString,
  to: ValidDateFromString,
  items: TolerantTopLevelArray(
    RewardRatePoint.pipe(Schema.decodeTo(ValidHistoryPoint)),
    { operation: "yield-reward-rate-history" }
  ),
});

export const TvlHistoryResponse = Schema.Struct({
  ...YieldApi.TvlHistoryResponseDto.fields,
  yieldId: YieldId,
  from: ValidDateFromString,
  to: ValidDateFromString,
  items: TolerantTopLevelArray(
    TvlPoint.pipe(Schema.decodeTo(ValidHistoryPoint)),
    { operation: "yield-tvl-history" }
  ),
});

export const RewardsToken = Schema.Struct({
  ...LegacyApi.TokenDto.fields,
  network: Network,
  address: Schema.optionalKey(TokenAddress),
  decimals: Schema.Number.check(Schema.isInt()),
});

export const RewardsSummary = Schema.Struct({
  ...LegacyApi.YieldRewardsSummaryResponseDto.fields,
  token: RewardsToken,
});
export type RewardsSummary = typeof RewardsSummary.Type;

export const RewardsSummaryRecord = TolerantTopLevelRecord(
  YieldId,
  RewardsSummary,
  { operation: "yield-rewards-summary" }
);

export const RewardsAddresses = Schema.Struct({
  address: WalletAddress,
  additionalAddresses: Schema.optionalKey(AdditionalAddresses),
});
export type RewardsAddresses = typeof RewardsAddresses.Type;
