import { useMatch } from "react-router";
import {
  historicalActivityCompletePaths,
  toActivityRouteMatchPath,
} from "./activity-route-paths";

export const useActivityReviewMatch = () => {
  const stakeReviewMatch = useMatch(
    toActivityRouteMatchPath(historicalActivityCompletePaths.stake)
  );
  const unstakeReviewMatch = useMatch(
    toActivityRouteMatchPath(historicalActivityCompletePaths.unstake)
  );
  const pendingReviewMatch = useMatch(
    toActivityRouteMatchPath(historicalActivityCompletePaths.pending)
  );

  return stakeReviewMatch || unstakeReviewMatch || pendingReviewMatch;
};
