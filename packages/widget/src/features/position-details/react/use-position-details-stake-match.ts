import { useMatch } from "react-router";
import { usePositionDetailsHubMatch } from "./use-position-details-hub-match";

export const usePositionDetailsStakeMatch = (path?: string) => {
  const stakeFlowMatch = useMatch(
    `positions/:integrationId/:balanceId/stake/${path ?? "*"}`
  );
  const hubMatch = usePositionDetailsHubMatch();

  if (path) return stakeFlowMatch;

  return hubMatch;
};
