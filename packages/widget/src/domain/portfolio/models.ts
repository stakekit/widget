import { Schema, Struct } from "effect";
import * as LegacyApi from "../../generated/api/legacy-schema";
import * as YieldApi from "../../generated/api/yield-schema";
import { TolerantArray, TolerantRecord } from "../decoding/response-schema";
import { ExactDecimal, UtcDateTimeFromString } from "../finance/scalars";
import { WalletAddress, YieldId } from "../identity/identifiers";
import { Token } from "../token/token";
import { AdditionalAddresses } from "../wallet/address";

export const KycStatus = YieldApi.KycStatusResponseDto;
export type KycStatus = typeof KycStatus.Type;

export const HistoryPeriod = Schema.Literals(["30d", "90d", "1y", "all"]);
export type HistoryPeriod = typeof HistoryPeriod.Type;

export const HistoryPoint = Schema.Struct({
  timestamp: Schema.DateTimeUtc,
  value: Schema.Finite,
});
export type HistoryPoint = typeof HistoryPoint.Type;

const RewardRateHistoryItem = Schema.Struct({
  ...YieldApi.RewardRateSnapshotDto.fields,
  rewardRate: ExactDecimal,
  timestamp: UtcDateTimeFromString,
});
export type RewardRateHistoryItem = typeof RewardRateHistoryItem.Type;

const TvlHistoryItem = Schema.Struct({
  timestamp: UtcDateTimeFromString,
  tvl: ExactDecimal,
  tvlRaw: Schema.String,
});
export type TvlHistoryItem = typeof TvlHistoryItem.Type;

// The response `interval` echoes the request and is unread, so it is not
// decoded.
export const RewardRateHistoryResponse = Schema.Struct({
  ...Struct.omit(YieldApi.RewardRateHistoryResponseDto.fields, ["interval"]),
  from: UtcDateTimeFromString,
  to: UtcDateTimeFromString,
  yieldId: YieldId,
  items: TolerantArray(RewardRateHistoryItem, {
    operation: "yield-reward-rate-history",
  }),
});

export const TvlHistoryResponse = Schema.Struct({
  ...Struct.omit(YieldApi.TvlHistoryResponseDto.fields, ["interval"]),
  from: UtcDateTimeFromString,
  to: UtcDateTimeFromString,
  yieldId: YieldId,
  items: TolerantArray(TvlHistoryItem, {
    operation: "yield-tvl-history",
  }),
});

export const RewardsSummary = Schema.Struct({
  ...LegacyApi.YieldRewardsSummaryResponseDto.fields,
  token: LegacyApi.TokenDto.pipe(Schema.decodeTo(Token)),
});
export type RewardsSummary = typeof RewardsSummary.Type;

export const RewardsSummaryRecord = TolerantRecord(YieldId, RewardsSummary, {
  operation: "yield-rewards-summary",
});

export const RewardsAddresses = Schema.Struct({
  address: WalletAddress,
  additionalAddresses: Schema.optionalKey(AdditionalAddresses),
});
export type RewardsAddresses = typeof RewardsAddresses.Type;
