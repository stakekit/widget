import { toRepresentationNumber } from "../../../domain/finance/exact";
import type {
  HistoryPoint,
  RewardRateHistoryItem,
  TvlHistoryItem,
} from "../../../domain/portfolio/models";

export const toRewardRateHistoryChartPoint = (
  item: RewardRateHistoryItem
): HistoryPoint => ({
  timestamp: item.timestamp,
  value: toRepresentationNumber(item.rewardRate.times(100)),
});

export const toTvlHistoryChartPoint = (item: TvlHistoryItem): HistoryPoint => ({
  timestamp: item.timestamp,
  value: toRepresentationNumber(item.tvl),
});
