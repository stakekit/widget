import { useMatch } from "react-router-dom";

export const useUnstakeMatch = (path?: string) =>
  useMatch(`positions/:integrationId/:balanceId/unstake/${path ?? "*"}`);
