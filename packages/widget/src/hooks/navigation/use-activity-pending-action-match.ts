import { useMatch } from "react-router";

export const useActivityPendingActionMatch = () => {
  const pendingActionComplete = useMatch("activity/pending/complete");
  const pendingActionReviewComplete = useMatch(
    "activity/pending-review/complete"
  );

  return pendingActionComplete || pendingActionReviewComplete;
};
