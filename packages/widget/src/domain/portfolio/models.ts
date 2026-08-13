import { Schema, SchemaGetter } from "effect";
import * as LegacyApi from "../../generated/api/legacy-schema";
import * as YieldApi from "../../generated/api/yield-schema";
import {
  TolerantTopLevelArray,
  TolerantTopLevelRecord,
} from "../decoding/response-schema";
import { UtcDateTimeFromString } from "../finance/scalars";
import { WalletAddress, YieldId } from "../identity/identifiers";
import { Token } from "../token/token";
import { AdditionalAddresses } from "../wallet/address";

export const KycStatus = YieldApi.KycStatusResponseDto;
export type KycStatus = typeof KycStatus.Type;

export const HistoryPeriod = Schema.Literals(["30d", "90d", "1y", "all"]);
export type HistoryPeriod = typeof HistoryPeriod.Type;

export const HistoryPoint = Schema.Struct({
  timestamp: Schema.DateTimeUtc,
  value: Schema.Number.check(Schema.isFinite()),
});
export type HistoryPoint = typeof HistoryPoint.Type;

const RewardRatePointWire = Schema.Struct({
  ...YieldApi.RewardRateSnapshotDto.fields,
  timestamp: UtcDateTimeFromString,
});

const RewardRatePoint = RewardRatePointWire.pipe(
  Schema.decodeTo(HistoryPoint, {
    decode: SchemaGetter.transform((item) => ({
      timestamp: item.timestamp,
      value: Number(item.rewardRate) * 100,
    })),
    encode: SchemaGetter.forbidden(
      () => "Resolved reward rate history points are decode-only"
    ),
  })
);

const TvlPointWire = Schema.Struct({
  timestamp: UtcDateTimeFromString,
  tvl: Schema.FiniteFromString,
  tvlRaw: Schema.String,
});

const TvlPoint = TvlPointWire.pipe(
  Schema.decodeTo(HistoryPoint, {
    decode: SchemaGetter.transform((item) => ({
      timestamp: item.timestamp,
      value: item.tvl,
    })),
    encode: SchemaGetter.forbidden(
      () => "Resolved TVL history points are decode-only"
    ),
  })
);

export const RewardRateHistoryResponse = Schema.Struct({
  ...YieldApi.RewardRateHistoryResponseDto.fields,
  from: UtcDateTimeFromString,
  to: UtcDateTimeFromString,
  yieldId: YieldId,
  items: TolerantTopLevelArray(
    RewardRatePoint.pipe(Schema.decodeTo(HistoryPoint)),
    { operation: "yield-reward-rate-history" }
  ),
});

export const TvlHistoryResponse = Schema.Struct({
  ...YieldApi.TvlHistoryResponseDto.fields,
  from: UtcDateTimeFromString,
  to: UtcDateTimeFromString,
  yieldId: YieldId,
  items: TolerantTopLevelArray(TvlPoint.pipe(Schema.decodeTo(HistoryPoint)), {
    operation: "yield-tvl-history",
  }),
});

export const RewardsSummary = Schema.Struct({
  ...LegacyApi.YieldRewardsSummaryResponseDto.fields,
  token: LegacyApi.TokenDto.pipe(Schema.decodeTo(Token)),
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
