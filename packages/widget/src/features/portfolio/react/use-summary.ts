import { useAtomValue } from "@effect/atom-react";
import {
  allPositionsSummaryAtom,
  availableBalanceSummaryAtom,
  averageApySummaryAtom,
} from "../state/read-models/summary";

export const useSummary = () => ({
  allPositionsResult: useAtomValue(allPositionsSummaryAtom),
  availableBalanceResult: useAtomValue(availableBalanceSummaryAtom),
  averageApyResult: useAtomValue(averageApySummaryAtom),
});
