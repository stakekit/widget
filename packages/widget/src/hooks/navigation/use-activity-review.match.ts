import { useMatch } from "react-router";

export const useActivityReviewMatch = () =>
  useMatch("activity/stake-review/complete") ||
  useMatch("activity/unstake-review/complete") ||
  useMatch("activity/pending-review/complete");
