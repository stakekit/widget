import { useMatch } from "react-router-dom";

export const useActivityUnstakeActionMatch = () =>
  useMatch("activity/complete/unstake");
