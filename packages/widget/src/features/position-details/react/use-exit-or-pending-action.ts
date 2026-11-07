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

/** The route's position workflow, without subscribing to its state. */
export const usePositionDetailsWorkflowKey = () => {
  const { plain, pendingActionType } = useExitOrPendingActionParams();
  const walletScope = useWalletScopeRoute();
  return new PositionDetailsWorkflowKey({
    balanceId: plain.balanceId ?? null,
    integrationId: plain.integrationId ?? null,
    pendingActionType: pendingActionType ?? null,
    scope: walletScope,
  });
};

export const useExitOrPendingAction = () => {
  const workflowKey = usePositionDetailsWorkflowKey();
  const state = useAtomValue(positionDetailsWorkflowViewAtom(workflowKey));
  const dispatchWorkflow = useAtomSet(
    dispatchPositionDetailsWorkflowAtom(workflowKey)
  );
  const dispatch = (action: PositionDetailsWorkflowAction) =>
    dispatchWorkflow(action);

  return { dispatch, state, workflowKey };
};
