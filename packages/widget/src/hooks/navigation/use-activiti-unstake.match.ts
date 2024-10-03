import { useMatch } from "react-router-dom";

export const useActivityUnstakeActionMatch = () =>
  useMatch("activity/unstake/complete") ||
  useMatch("activity/unstake-review/complete");
