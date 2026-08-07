import type { HistoryPeriod } from "../../../../../domain/schema/dashboard-models";
import type { YieldId } from "../../../../../domain/schema/identifiers";
import {
  YieldHistoryKey,
  yieldTvlHistoryAtom,
} from "../../../../yield-summary/state";
import { useYieldHistory } from "./use-yield-history";

export const useYieldTvlHistory = ({
  period,
  yieldId,
}: {
  period: HistoryPeriod;
  yieldId: YieldId | undefined;
}) => {
  return useYieldHistory(
    yieldTvlHistoryAtom(
      new YieldHistoryKey({ period, yieldId: yieldId ?? null })
    )
  );
};
