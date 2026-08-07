import { useMatch } from "react-router";

export const usePositionDetailsHubMatch = () =>
  useMatch("positions/:integrationId/:balanceId");
