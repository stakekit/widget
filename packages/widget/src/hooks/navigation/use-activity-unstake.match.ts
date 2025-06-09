import { useMatch } from "react-router";

export const useActivityUnstakeActionMatch = () => {
  const unstakeCompleteMatch = useMatch("activity/unstake/complete");
  const unstakeReviewMatch = useMatch("activity/unstake-review/complete");

  return unstakeCompleteMatch || unstakeReviewMatch;
};
