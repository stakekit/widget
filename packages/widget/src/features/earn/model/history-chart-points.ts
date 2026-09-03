import type {
  HistoryPoint,
  RewardRateHistoryItem,
  TvlHistoryItem,
} from "../../../domain/portfolio/models";
import { toChartNumber } from "../../../shared/lib/number-format";

export const toRewardRateHistoryChartPoint = (
  item: RewardRateHistoryItem
): HistoryPoint => ({
  timestamp: item.timestamp,
  value: toChartNumber(item.rewardRate.times(100)),
});

export const toTvlHistoryChartPoint = (item: TvlHistoryItem): HistoryPoint => ({
  timestamp: item.timestamp,
  value: toChartNumber(item.tvl),
});
