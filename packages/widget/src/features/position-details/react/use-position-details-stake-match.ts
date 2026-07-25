import { useMatch } from "react-router";
import { useUnstakeOrPendingActionMatch } from "./use-unstake-or-pending-action-match";

export const usePositionDetailsStakeMatch = (path?: string) => {
  const positionDetailsIndexMatch = useMatch(
    "positions/:integrationId/:balanceId"
  );
  const stakeMatch = useUnstakeOrPendingActionMatch(`stake/${path ?? "*"}`);

  if (path) return stakeMatch;

  return stakeMatch ?? positionDetailsIndexMatch;
};
