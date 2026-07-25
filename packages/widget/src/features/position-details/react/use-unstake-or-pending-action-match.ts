import { useMatch } from "react-router";

export const useUnstakeOrPendingActionMatch = (path?: string) =>
  useMatch(`positions/:integrationId/:balanceId/${path ?? "*"}`);
