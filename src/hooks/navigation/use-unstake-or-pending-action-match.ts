import { useMatch } from "react-router-dom";

export const useUnstakeOrPendingActionMatch = (path?: string) =>
  useMatch<
    "integrationId" | "balanceId",
    `positions/:integrationId/:balanceId/${string}`
  >(`positions/:integrationId/:balanceId/${path ?? "*"}`);
