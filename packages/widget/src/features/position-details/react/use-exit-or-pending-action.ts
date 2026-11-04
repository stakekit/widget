import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useWalletScopeRoute } from "../../wallet/index";
import {
  type PositionDetailsWorkflowAction,
  PositionDetailsWorkflowKey,
} from "../state/workflow";
import {
  dispatchPositionDetailsWorkflowAtom,
  positionDetailsWorkflowViewAtom,
} from "../state/workflow-view";
import { useExitOrPendingActionParams } from "./use-exit-or-pending-action-params";

export const useExitOrPendingAction = () => {
  const { plain, pendingActionType } = useExitOrPendingActionParams();
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
