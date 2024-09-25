import { useMatch } from "react-router-dom";

export const useActivityReviewMatch = () =>
  useMatch("activity/stake-review/complete") ||
  useMatch("activity/unstake-review/complete") ||
  useMatch("activity/pending-review/complete");
