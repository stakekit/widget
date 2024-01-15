import { useMatch } from "react-router-dom";

export const usePendingActionMatch = (path?: string) =>
  useMatch(`positions/:integrationId/:balanceId/pending-action/${path ?? "*"}`);
