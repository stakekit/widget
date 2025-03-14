import { useMatch } from "react-router";

export const useActivityPendingActionMatch = () =>
  useMatch("activity/pending/complete") ||
  useMatch("activity/pending-review/complete");
