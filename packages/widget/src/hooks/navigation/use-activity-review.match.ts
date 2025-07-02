import { useMatch } from "react-router";

export const useActivityReviewMatch = () => {
  const stakeReviewComplete = useMatch("activity/stake-review/complete");
  const unstakeReviewComplete = useMatch("activity/unstake-review/complete");
  const pendingReviewComplete = useMatch("activity/pending-review/complete");

  return stakeReviewComplete || unstakeReviewComplete || pendingReviewComplete;
};
