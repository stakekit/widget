import { useMatch } from "react-router-dom";

export const useActivityPendingActionMatch = () =>
  useMatch("activity/pending/complete");
