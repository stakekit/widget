import { useMatch } from "react-router";
import { usePositionDetailsHubMatch } from "./use-position-details-hub-match";

export const useUnstakeOrPendingActionMatch = (path?: string) => {
  const specificMatch = useMatch(
    `positions/:integrationId/:balanceId/${path ?? "*"}`
  );
  const nestedMatch = useMatch("positions/:integrationId/:balanceId/*");
  const hubMatch = usePositionDetailsHubMatch();

  if (path) return specificMatch;

  return nestedMatch ?? hubMatch;
};
