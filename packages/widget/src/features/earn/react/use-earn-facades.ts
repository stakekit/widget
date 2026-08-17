import { useAtomSet, useAtomValue } from "@effect/atom-react";
import {
  earnEntryViewAtom,
  earnPageStatusViewAtom,
  earnTokenSelectionViewAtom,
  earnValidatorModalEventAtom,
  earnValidatorSelectionViewAtom,
  earnYieldSelectionViewAtom,
  loadMoreEarnValidatorsAtom,
  refreshEarnKycAtom,
  removeEarnValidatorAtom,
  runEarnPrimaryActionAtom,
  selectEarnCategoryAtom,
  selectEarnProviderAtom,
  selectEarnTokenAtom,
  selectEarnTronResourceAtom,
  selectEarnValidatorAtom,
  selectEarnYieldAtom,
  setEarnAmountAtom,
  setEarnMaxAmountAtom,
  setEarnTokenSearchAtom,
  setEarnValidatorSearchAtom,
  setEarnYieldSearchAtom,
} from "../state/runtime";

export const useEarnTokenSelection = () => ({
  select: useAtomSet(selectEarnTokenAtom),
  setSearch: useAtomSet(setEarnTokenSearchAtom),
  view: useAtomValue(earnTokenSelectionViewAtom),
});

export const useEarnYieldSelection = () => ({
  select: useAtomSet(selectEarnYieldAtom),
  selectCategory: useAtomSet(selectEarnCategoryAtom),
  setSearch: useAtomSet(setEarnYieldSearchAtom),
  view: useAtomValue(earnYieldSelectionViewAtom),
});

export const useEarnValidatorSelection = () => ({
  recordModalEvent: useAtomSet(earnValidatorModalEventAtom),
  loadMore: useAtomSet(loadMoreEarnValidatorsAtom),
  remove: useAtomSet(removeEarnValidatorAtom),
  select: useAtomSet(selectEarnValidatorAtom),
  setSearch: useAtomSet(setEarnValidatorSearchAtom),
  view: useAtomValue(earnValidatorSelectionViewAtom),
});

export const useEarnEntry = () => ({
  refreshKyc: useAtomSet(refreshEarnKycAtom),
  runPrimaryAction: useAtomSet(runEarnPrimaryActionAtom),
  selectProvider: useAtomSet(selectEarnProviderAtom),
  selectTronResource: useAtomSet(selectEarnTronResourceAtom),
  setAmount: useAtomSet(setEarnAmountAtom),
  setMaxAmount: useAtomSet(setEarnMaxAmountAtom),
  view: useAtomValue(earnEntryViewAtom),
});

export const useEarnPageStatus = () => ({
  view: useAtomValue(earnPageStatusViewAtom),
});
