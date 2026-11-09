import { Schema, Struct } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { TolerantArray } from "../decoding/response-schema";
import { ExactDecimal, UtcDateTimeFromString } from "../finance/scalars";
import { TokenAddress, YieldId } from "../identity/identifiers";

export const KycStatus = YieldApi.KycStatusResponseDto.mapFields(
  Struct.pick(["kycStatus", "authorizeUrl"])
);
export type KycStatus = typeof KycStatus.Type;

export const HistoryPeriod = Schema.Literals(["30d", "90d", "1y", "all"]);
export type HistoryPeriod = typeof HistoryPeriod.Type;

export const HistoryPoint = Schema.Struct({
  timestamp: Schema.DateTimeUtc,
  value: Schema.Finite,
});
export type HistoryPoint = typeof HistoryPoint.Type;

const RewardRateHistoryItem = Schema.Struct({
  rewardRate: ExactDecimal,
  timestamp: UtcDateTimeFromString,
});
export type RewardRateHistoryItem = typeof RewardRateHistoryItem.Type;

// `tvlRaw` is unread: the chart plots `tvl` in token units.
const TvlHistoryItem = Schema.Struct({
  timestamp: UtcDateTimeFromString,
  tvl: ExactDecimal,
});
export type TvlHistoryItem = typeof TvlHistoryItem.Type;

// The response `interval` echoes the request and is unread, so it is not
// decoded.
export const RewardRateHistoryResponse = Schema.Struct({
  from: UtcDateTimeFromString,
  to: UtcDateTimeFromString,
  yieldId: YieldId,
  items: TolerantArray(RewardRateHistoryItem, {
    operation: "yield-reward-rate-history",
  }),
});

export const TvlHistoryResponse = Schema.Struct({
  from: UtcDateTimeFromString,
  to: UtcDateTimeFromString,
  yieldId: YieldId,
  items: TolerantArray(TvlHistoryItem, {
    operation: "yield-tvl-history",
  }),
});

/** Signed earnings over one window, in token units; `amountRaw` is unread. */
const RewardWindowAmount = Schema.Struct({ amount: ExactDecimal });

/**
 * What a wallet has earned in a Yield's base token since it was first
 * indexed, over fixed windows ending at the last aggregated hour. Each
 * window is signed: a loss reads negative.
 */
export const YieldRewardsSummary = Schema.Struct({
  token: Schema.Struct({
    ...Struct.pick(YieldApi.YieldRewardTokenDto.fields, [
      "symbol",
      "decimals",
      "network",
    ]),
    address: Schema.optionalKey(TokenAddress),
  }),
  last24H: RewardWindowAmount,
  last7D: RewardWindowAmount,
  last30D: RewardWindowAmount,
  lastYear: RewardWindowAmount,
  total: RewardWindowAmount,
});
export type YieldRewardsSummary = typeof YieldRewardsSummary.Type;
