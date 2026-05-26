import { useMatch } from "react-router";

export const usePendingActionSelectValidatorMatch = () =>
  useMatch(
    "positions/:integrationId/:balanceId/select-validator/:pendingActionType"
  );
