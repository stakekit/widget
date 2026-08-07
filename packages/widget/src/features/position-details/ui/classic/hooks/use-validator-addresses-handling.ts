import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ValidatorInput as ValidatorDto } from "../../../../../domain/types/validators";
import type { SelectModalProps } from "../../../../../shared/ui/components/select-modal";
import {
  closePositionPendingActionModalAtom,
  openPositionPendingActionModalAtom,
  positionPendingActionModalViewAtom,
  togglePositionPendingActionValidatorAtom,
} from "../../../state/classic-flow-actions";
import type { PositionDetailsWorkflowKey } from "../../../state/workflow";

export const useValidatorAddressesHandling = (
  workflowKey: PositionDetailsWorkflowKey
) => {
  const state = useAtomValue(positionPendingActionModalViewAtom(workflowKey));
  const close = useAtomSet(closePositionPendingActionModalAtom(workflowKey));
  const toggle = useAtomSet(
    togglePositionPendingActionValidatorAtom(workflowKey)
  );
  const open = useAtomSet(openPositionPendingActionModalAtom(workflowKey));
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
    onItemClick: (validator: ValidatorDto["address"]) => toggle(validator),
    openModal: open,
    pendingActionDto: isOpen ? state.pendingAction.pendingActionDto : null,
    selectedValidators: state.selectedValidators,
    showValidatorsModal: isOpen,
    submitDisabled: state.selectedValidators.size === 0,
    yieldBalance: isOpen ? state.pendingAction.yieldBalance : null,
  };
};
