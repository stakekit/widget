import { useAtomValue } from "@effect/atom-react";
import {
  allPositionsSummaryAtom,
  availableBalanceSummaryAtom,
  averageApySummaryAtom,
  rewardsPositionsSummaryAtom,
} from "..";

export const useSummary = () => ({
  allPositionsQuery: useAtomValue(allPositionsSummaryAtom),
  availableBalanceSumQuery: useAtomValue(availableBalanceSummaryAtom),
  averageApyQuery: useAtomValue(averageApySummaryAtom),
  rewardsPositionsQuery: useAtomValue(rewardsPositionsSummaryAtom),
});
