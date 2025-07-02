import { useMatch } from "react-router";

export const useActivityUnstakeActionMatch = () => {
  const unstakeComplete = useMatch("activity/unstake/complete");
  const unstakeReviewComplete = useMatch("activity/unstake-review/complete");

  return unstakeComplete || unstakeReviewComplete;
};
