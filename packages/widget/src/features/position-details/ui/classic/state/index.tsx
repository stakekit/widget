import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useUnstakeOrPendingActionParams } from "../../../../../shared/react/navigation/use-unstake-or-pending-action-params";
import { useWalletScopeRoute } from "../../../../wallet/react/wallet-scope-route";
import {
  dispatchPositionDetailsWorkflowAtom,
  positionDetailsWorkflowViewAtom,
} from "../../../state/classic-view";
import {
  type PositionDetailsWorkflowAction,
  PositionDetailsWorkflowKey,
} from "../../../state/workflow";

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
