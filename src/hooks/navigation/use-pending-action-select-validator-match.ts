import { useMatch } from "react-router-dom";

export const usePendingActionSelectValidatorMatch = () =>
  useMatch<
    "integrationId" | "balanceId" | "pendingActionType",
    "positions/:integrationId/:balanceId/select-validator/:pendingActionType"
  >(`positions/:integrationId/:balanceId/select-validator/:pendingActionType`);
