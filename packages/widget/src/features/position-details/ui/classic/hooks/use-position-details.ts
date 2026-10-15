import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type BigNumber from "bignumber.js";
import { useUnstakeOrPendingAction } from "../../../react/use-unstake-or-pending-action";
import {
  hidePositionDetailsBalancesAtom,
  revealPositionDetailsBalancesAtom,
  revealPositionDetailsBalancesStatusAtom,
} from "../../../state/classic-actions/reveal";
import {
  loadMorePositionDetailsValidatorsAtom,
  positionDetailsClassicViewAtom,
  refreshPositionDetailsKycAtom,
  setPositionDetailsExitAmountAtom,
  setPositionDetailsExitMaxAmountAtom,
  setPositionDetailsExitReceiveTokenAtom,
  submitPositionDetailsExitAtom,
} from "../../../state/classic-facade";
import { usePendingActions } from "./use-pending-actions";

export const usePositionDetails = () => {
  const { dispatch, workflowKey } = useUnstakeOrPendingAction();
  const view = useAtomValue(positionDetailsClassicViewAtom(workflowKey));
  const setAmount = useAtomSet(setPositionDetailsExitAmountAtom(workflowKey));
  const setMaxAmount = useAtomSet(
    setPositionDetailsExitMaxAmountAtom(workflowKey)
  );
  const setReceiveToken = useAtomSet(
    setPositionDetailsExitReceiveTokenAtom(workflowKey)
  );
  const submitExit = useAtomSet(submitPositionDetailsExitAtom(workflowKey));
  const refreshKyc = useAtomSet(refreshPositionDetailsKycAtom(workflowKey));
  const hideBalances = useAtomSet(hidePositionDetailsBalancesAtom(workflowKey));
  const revealBalances = useAtomSet(
    revealPositionDetailsBalancesAtom(workflowKey)
  );
  const revealStatus = useAtomValue(
    revealPositionDetailsBalancesStatusAtom(workflowKey)
  );
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
    onReceiveTokenSelect: setReceiveToken,
    onHideBalances: () => hideBalances(undefined),
    onRevealBalances: () => revealBalances(undefined),
    revealFailed: revealStatus.failed,
    revealing: revealStatus.revealing,
    onUnstakeAmountChange: (amount: BigNumber) => setAmount(amount),
    onUnstakeClick: () => submitExit(undefined),
    onValidatorsSubmit,
    pendingActions,
    validatorAddressesHandling,
  };
};
