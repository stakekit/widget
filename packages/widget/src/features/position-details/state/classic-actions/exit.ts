import {
  positionDetailsExitActionViewAtom as exitActionView,
  setPositionDetailsExitMaxAmountAtom as setMaxAmount,
  setPositionDetailsExitReceiveTokenAtom as setReceiveToken,
  submitPositionDetailsExitAtom as submit,
} from "./runtime";

export const positionDetailsExitActions = {
  setMaxAmount,
  setReceiveToken,
  submit,
  view: exitActionView,
} as const;
