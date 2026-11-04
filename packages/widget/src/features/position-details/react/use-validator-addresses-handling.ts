import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { EarnValidator } from "../../../domain/earn/models";
import type { SelectModalProps } from "../../../shared/ui/components/select-modal";
import { positionDetailsPendingActions } from "../state/actions/pending-action";
import type { PositionDetailsWorkflowKey } from "../state/workflow";

export const useValidatorAddressesHandling = (
  workflowKey: PositionDetailsWorkflowKey
) => {
  const state = useAtomValue(
    positionDetailsPendingActions.modalView(workflowKey)
  );
  const close = useAtomSet(
    positionDetailsPendingActions.closeModal(workflowKey)
  );
  const toggle = useAtomSet(
    positionDetailsPendingActions.toggleValidator(workflowKey)
  );
  const open = useAtomSet(positionDetailsPendingActions.openModal(workflowKey));
  const isOpen = state._tag === "Open";
  const modalState: SelectModalProps["state"] = {
    isOpen,
    setOpen: (value) => {
      if (!value) close(undefined);
    },
  };

  return {
    closeModal: () => close(undefined),
    modalState,
    multiSelect: state.multiSelect,
    onItemClick: (validator: EarnValidator) => toggle(validator),
    openModal: open,
    pendingAction: isOpen ? state.pendingAction.pendingAction : null,
    selectedValidatorKeys: new Set(state.selectedValidators.keys()),
    showValidatorsModal: isOpen,
    submitDisabled: state.selectedValidators.size === 0,
    yieldBalance: isOpen ? state.pendingAction.yieldBalance : null,
  };
};
