import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type BigNumber from "bignumber.js";
import {
  loadMorePositionDetailsValidatorsAtom,
  positionDetailsClassicViewAtom,
  refreshPositionDetailsKycAtom,
  setPositionDetailsExitAmountAtom,
  setPositionDetailsExitMaxAmountAtom,
  submitPositionDetailsExitAtom,
} from "../../../state/classic-facade";
import { useUnstakeOrPendingAction } from "../state";
import { usePendingActions } from "./use-pending-actions";

export const usePositionDetails = () => {
  const { dispatch, workflowKey } = useUnstakeOrPendingAction();
  const view = useAtomValue(positionDetailsClassicViewAtom(workflowKey));
  const setAmount = useAtomSet(setPositionDetailsExitAmountAtom(workflowKey));
  const setMaxAmount = useAtomSet(
    setPositionDetailsExitMaxAmountAtom(workflowKey)
  );
  const submitExit = useAtomSet(submitPositionDetailsExitAtom(workflowKey));
  const refreshKyc = useAtomSet(refreshPositionDetailsKycAtom(workflowKey));
  const loadMoreValidators = useAtomSet(
    loadMorePositionDetailsValidatorsAtom(workflowKey)
  );
  const {
    onPendingActionAmountChange,
    pendingActions,
    onPendingActionClick,
    onValidatorsSubmit,
    validatorAddressesHandling,
  } = usePendingActions({
    dispatch,
    workflowKey,
  });

  return {
    ...view,
    onKycStatusRefresh: () => refreshKyc(undefined),
    onLoadMoreValidators: () => loadMoreValidators(undefined),
    onMaxClick: () => setMaxAmount(undefined),
    onPendingActionAmountChange,
    onPendingActionClick,
    onUnstakeAmountChange: (amount: BigNumber) => setAmount(amount),
    onUnstakeClick: () => submitExit(undefined),
    onValidatorsSubmit,
    pendingActions,
    validatorAddressesHandling,
  };
};
