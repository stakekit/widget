import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { PendingAction } from "../../../domain/action/models";
import type { EarnBalance } from "../../../domain/earn/models";

import { positionDetailsPendingActions } from "../state/actions/pending-action";
import type {
  PositionDetailsWorkflowAction as Actions,
  PendingActionAmountChange,
  PositionDetailsWorkflowKey,
} from "../state/workflow";
import { positionDetailsPendingActionsViewAtom } from "../state/workflow-view";
import { useValidatorAddressesHandling } from "./use-validator-addresses-handling";

export const usePendingActions = ({
  dispatch: pendingActionDispatch,
  workflowKey,
}: {
  readonly dispatch: (action: Actions) => void;
  readonly workflowKey: PositionDetailsWorkflowKey;
}) => {
  const pendingActions = useAtomValue(
    positionDetailsPendingActionsViewAtom(workflowKey)
  );

  const onPendingActionAmountChange = (
    data: PendingActionAmountChange["data"]
  ) => pendingActionDispatch({ type: "pendingAction/amount/change", data });

  const validatorAddressesHandling = useValidatorAddressesHandling(workflowKey);
  const runPendingAction = useAtomSet(
    positionDetailsPendingActions.run(workflowKey)
  );

  const onPendingActionClick = ({
    yieldBalance,
    pendingAction,
  }: {
    pendingAction: PendingAction;
    yieldBalance: EarnBalance;
  }) => {
    runPendingAction({
      _tag: "Select",
      pendingAction,
      yieldBalance,
    });
  };

  const onValidatorsSubmit = () =>
    runPendingAction({ _tag: "SubmitValidators" });

  return {
    onPendingActionAmountChange,
    validatorAddressesHandling,
    pendingActions,
    onPendingActionClick,
    onValidatorsSubmit,
  };
};
