import type { HistoryPeriod } from "../../../../../domain/schema/dashboard-models";
import type { YieldId } from "../../../../../domain/schema/identifiers";
import {
  YieldHistoryKey,
  yieldRewardRateHistoryAtom,
} from "../../../../yield-summary/state";
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
    )
  );
};
