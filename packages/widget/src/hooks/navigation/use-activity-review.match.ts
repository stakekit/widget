import { useMatch } from "react-router";

export const useActivityReviewMatch = () => {
  const stakeReviewMatch = useMatch("activity/stake-review/complete");
  const unstakeReviewMatch = useMatch("activity/unstake-review/complete");
  const pendingReviewMatch = useMatch("activity/pending-review/complete");

  return stakeReviewMatch || unstakeReviewMatch || pendingReviewMatch;
};
