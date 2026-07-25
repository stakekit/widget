import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { PendingAction } from "../../../../../domain/schema/action-models";
import type { EarnBalance } from "../../../../../domain/schema/earn-models";

import type { ValidatorInput as ValidatorDto } from "../../../../../domain/types/validators";
import { runPositionPendingActionAtom } from "../../../state/classic-flow-actions";
import { positionDetailsPendingActionsViewAtom } from "../../../state/classic-view";
import type {
  PositionDetailsWorkflowAction as Actions,
  PendingActionAmountChange,
  PositionDetailsWorkflowKey,
} from "../../../state/workflow";
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
    runPositionPendingActionAtom(workflowKey)
  );

  const onPendingActionClick = ({
    yieldBalance,
    pendingActionDto,
  }: {
    pendingActionDto: PendingAction;
    yieldBalance: EarnBalance;
  }) => {
    runPendingAction({
      _tag: "Select",
      pendingActionDto,
      yieldBalance,
    });
  };

  const onValidatorsSubmit = (_selectedValidators: ValidatorDto["address"][]) =>
    runPendingAction({ _tag: "SubmitValidators" });

  return {
    onPendingActionAmountChange,
    validatorAddressesHandling,
    pendingActions,
    onPendingActionClick,
    onValidatorsSubmit,
  };
};
