import { useUnstakeOrPendingActionMatch } from "./use-unstake-or-pending-action-match";

export const usePendingActionMatch = (path?: string) =>
  useUnstakeOrPendingActionMatch(`pending-action/${path ?? "*"}`);
