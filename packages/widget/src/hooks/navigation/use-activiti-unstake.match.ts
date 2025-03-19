import { useMatch } from "react-router";

export const useActivityUnstakeActionMatch = () =>
  useMatch("activity/unstake/complete") ||
  useMatch("activity/unstake-review/complete");
