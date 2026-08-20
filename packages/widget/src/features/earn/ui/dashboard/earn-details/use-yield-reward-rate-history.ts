import type { YieldId } from "../../../../../domain/identity/identifiers";
import type { HistoryPeriod } from "../../../../../domain/portfolio/models";
import {
  YieldHistoryKey,
  yieldRewardRateHistoryAtom,
} from "../../../../yield-summary/index";
import { toRewardRateHistoryChartPoint } from "./history-chart-points";
import { useYieldHistory } from "./use-yield-history";

export const useYieldRewardRateHistory = ({
  period,
  yieldId,
}: {
  period: HistoryPeriod;
  yieldId: YieldId | undefined;
}) => {
  return useYieldHistory(
    yieldRewardRateHistoryAtom(
      new YieldHistoryKey({ period, yieldId: yieldId ?? null })
    ),
    toRewardRateHistoryChartPoint
  );
};
