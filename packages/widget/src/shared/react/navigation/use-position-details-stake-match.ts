import { useMatch } from "react-router";
import { useUnstakeOrPendingActionMatch } from "./use-unstake-or-pending-action-match";

export const getPositionDetailsStakeReviewPath = ({
  balanceId,
  integrationId,
}: {
  balanceId?: string;
  integrationId?: string;
}) =>
  integrationId && balanceId
    ? `/positions/${integrationId}/${balanceId}/stake/review`
    : null;

export const usePositionDetailsStakeMatch = (path?: string) => {
  const positionDetailsIndexMatch = useMatch(
    "positions/:integrationId/:balanceId"
  );
  const stakeMatch = useUnstakeOrPendingActionMatch(`stake/${path ?? "*"}`);

  if (path) return stakeMatch;

  return stakeMatch ?? positionDetailsIndexMatch;
};
