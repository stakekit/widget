import { Maybe } from "purify-ts";
import { useMemo } from "react";
import type { YieldPendingActionType } from "../../domain/types/pending-action";
import { usePendingActionSelectValidatorMatch } from "./use-pending-action-select-validator-match";
import { useUnstakeOrPendingActionMatch } from "./use-unstake-or-pending-action-match";

type PositionDetailsParams = {
  balanceId?: string;
  integrationId?: string;
};

export const getPositionDetailsUnstakeReviewPath = ({
  balanceId,
  integrationId,
}: PositionDetailsParams) =>
  integrationId && balanceId
    ? `/positions/${integrationId}/${balanceId}/unstake/review`
    : null;

export const getPositionDetailsPendingActionReviewPath = ({
  balanceId,
  integrationId,
}: PositionDetailsParams) =>
  integrationId && balanceId
    ? `/positions/${integrationId}/${balanceId}/pending-action/review`
    : null;

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
