import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useWalletScopeRoute } from "../../wallet/ui";
import {
  dispatchPositionDetailsWorkflowAtom,
  positionDetailsWorkflowViewAtom,
} from "../state/classic-view";
import {
  type PositionDetailsWorkflowAction,
  PositionDetailsWorkflowKey,
} from "../state/workflow";
import { useUnstakeOrPendingActionParams } from "./use-unstake-or-pending-action-params";

export const useUnstakeOrPendingAction = () => {
  const { plain, pendingActionType } = useUnstakeOrPendingActionParams();
  const walletScope = useWalletScopeRoute();
  const workflowKey = new PositionDetailsWorkflowKey({
    balanceId: plain.balanceId ?? null,
    integrationId: plain.integrationId ?? null,
    pendingActionType: pendingActionType ?? null,
    scope: walletScope,
  });
  const state = useAtomValue(positionDetailsWorkflowViewAtom(workflowKey));
  const dispatchWorkflow = useAtomSet(
    dispatchPositionDetailsWorkflowAtom(workflowKey)
  );
  const dispatch = (action: PositionDetailsWorkflowAction) =>
    dispatchWorkflow(action);

  return { dispatch, state, workflowKey };
};
