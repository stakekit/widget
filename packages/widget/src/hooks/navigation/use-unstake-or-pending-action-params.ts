import { Option, Schema } from "effect";
import { useMemo } from "react";
import { YieldId } from "../../domain/schema/identifiers";
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
    const { balanceId, integrationId: rawIntegrationId } =
      unstakeOrPendingActionFlowMatch?.params ??
      pendingActionSelectValidatorMatch?.params ??
      {};

    const integrationId = rawIntegrationId
      ? Schema.decodeOption(YieldId)(rawIntegrationId).pipe(
          Option.getOrUndefined
        )
      : undefined;

    const pendingActionType = pendingActionSelectValidatorMatch?.params
      .pendingActionType as YieldPendingActionType | undefined;

    return {
      balanceId: balanceId ?? null,
      integrationId: integrationId ?? null,
      pendingActionType: pendingActionType ?? null,
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
