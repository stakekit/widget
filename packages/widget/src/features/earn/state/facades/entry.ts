import {
  earnEntryViewAtom,
  refreshEarnKycAtom,
  runEarnPrimaryActionAtom,
  selectEarnProviderAtom,
  selectEarnTronResourceAtom,
  setEarnAmountAtom,
  setEarnMaxAmountAtom,
} from "./runtime";

export const earnEntryFacade = {
  refreshKyc: refreshEarnKycAtom,
  runPrimaryAction: runEarnPrimaryActionAtom,
  selectProvider: selectEarnProviderAtom,
  selectTronResource: selectEarnTronResourceAtom,
  setAmount: setEarnAmountAtom,
  setMaxAmount: setEarnMaxAmountAtom,
  view: earnEntryViewAtom,
} as const;
