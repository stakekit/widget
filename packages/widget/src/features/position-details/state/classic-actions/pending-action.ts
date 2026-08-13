import {
  closePositionPendingActionModalAtom as closeModal,
  positionPendingActionModalViewAtom as modalView,
  openPositionPendingActionModalAtom as openModal,
  runPositionPendingActionAtom as run,
  togglePositionPendingActionValidatorAtom as toggleValidator,
} from "./runtime";

export const positionDetailsPendingActions = {
  closeModal,
  modalView,
  openModal,
  run,
  toggleValidator,
} as const;
