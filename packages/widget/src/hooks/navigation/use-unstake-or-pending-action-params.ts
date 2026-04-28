import { Maybe } from "purify-ts";
import { useMemo } from "react";
import type { YieldPendingActionType } from "../../providers/yield-api-client-provider/types";
import { usePendingActionSelectValidatorMatch } from "./use-pending-action-select-validator-match";
import { useUnstakeOrPendingActionMatch } from "./use-unstake-or-pending-action-match";

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
      .pendingActionType as YieldPendingActionType | undefined;

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
