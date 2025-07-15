import { useMatch } from "react-router";

export const useActivityPendingActionMatch = () => {
  const pendingCompleteMatch = useMatch("activity/pending/complete");
  const pendingReviewMatch = useMatch("activity/pending-review/complete");

  return pendingCompleteMatch || pendingReviewMatch;
};
