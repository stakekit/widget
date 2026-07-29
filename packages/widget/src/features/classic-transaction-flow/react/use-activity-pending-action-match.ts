import { useMatch } from "react-router";
import {
  historicalActivityCompletePaths,
  toActivityRouteMatchPath,
} from "./activity-route-paths";

export const useActivityPendingActionMatch = () => {
  const pendingCompleteMatch = useMatch("activity/pending/complete");
  const pendingReviewMatch = useMatch(
    toActivityRouteMatchPath(historicalActivityCompletePaths.pending)
  );

  return pendingCompleteMatch || pendingReviewMatch;
};
