import { useUnstakeOrPendingActionMatch } from "./use-unstake-or-pending-action-match";

export const useUnstakeMatch = (path?: string) =>
  useUnstakeOrPendingActionMatch(`unstake/${path ?? "*"}`);
