import { usePendingActionSelectValidatorMatch } from "@sk-widget/hooks/navigation/use-pending-action-select-validator-match";
import { useUnstakeOrPendingActionMatch } from "@sk-widget/hooks/navigation/use-unstake-or-pending-action-match";
import type { ActionTypes } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useMemo } from "react";

export const useUnstakeOrPendingActionParams = () => {
  const unstakeOrPendingActionFlowMatch = useUnstakeOrPendingActionMatch();
  const pendingActionSelectValidatorMatch =
    usePendingActionSelectValidatorMatch();

  return useMemo(() => {
    const { balanceId, integrationId } =
      unstakeOrPendingActionFlowMatch?.params ??
      pendingActionSelectValidatorMatch?.params ??
      {};

    const pendingActionType = pendingActionSelectValidatorMatch?.params
      .pendingActionType as ActionTypes | undefined;

    return {
      balanceId: Maybe.fromNullable(balanceId),
      integrationId: Maybe.fromNullable(integrationId),
      pendingActionType: Maybe.fromNullable(pendingActionType),
      plain: {
        balanceId,
        integrationId,
        pendingActionType,
      },
    };
  }, [
    pendingActionSelectValidatorMatch?.params,
    unstakeOrPendingActionFlowMatch?.params,
  ]);
};
