import { useMatch } from "react-router";
import {
  historicalActivityCompletePaths,
  toActivityRouteMatchPath,
} from "./activity-route-paths";

export const useActivityUnstakeActionMatch = () => {
  const unstakeCompleteMatch = useMatch("activity/unstake/complete");
  const unstakeReviewMatch = useMatch(
    toActivityRouteMatchPath(historicalActivityCompletePaths.unstake)
  );

  return unstakeCompleteMatch || unstakeReviewMatch;
};
