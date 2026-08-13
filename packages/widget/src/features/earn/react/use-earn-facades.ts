import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { earnEntryFacade } from "../state/facades/entry";
import { earnPageStatusFacade } from "../state/facades/page-status";
import { tokenSelectionFacade } from "../state/facades/token-selection";
import { validatorSelectionFacade } from "../state/facades/validator-selection";
import { yieldSelectionFacade } from "../state/facades/yield-selection";

export const useEarnTokenSelection = () => ({
  loadMore: useAtomSet(tokenSelectionFacade.loadMore),
  select: useAtomSet(tokenSelectionFacade.select),
  setSearch: useAtomSet(tokenSelectionFacade.setSearch),
  view: useAtomValue(tokenSelectionFacade.view),
});

export const useEarnYieldSelection = () => ({
  select: useAtomSet(yieldSelectionFacade.select),
  selectCategory: useAtomSet(yieldSelectionFacade.selectCategory),
  setSearch: useAtomSet(yieldSelectionFacade.setSearch),
  view: useAtomValue(yieldSelectionFacade.view),
});

export const useEarnValidatorSelection = () => ({
  recordModalEvent: useAtomSet(validatorSelectionFacade.recordModalEvent),
  loadMore: useAtomSet(validatorSelectionFacade.loadMore),
  remove: useAtomSet(validatorSelectionFacade.remove),
  select: useAtomSet(validatorSelectionFacade.select),
  setSearch: useAtomSet(validatorSelectionFacade.setSearch),
  view: useAtomValue(validatorSelectionFacade.view),
});

export const useEarnEntry = () => ({
  refreshKyc: useAtomSet(earnEntryFacade.refreshKyc),
  runPrimaryAction: useAtomSet(earnEntryFacade.runPrimaryAction),
  selectProvider: useAtomSet(earnEntryFacade.selectProvider),
  selectTronResource: useAtomSet(earnEntryFacade.selectTronResource),
  setAmount: useAtomSet(earnEntryFacade.setAmount),
  setMaxAmount: useAtomSet(earnEntryFacade.setMaxAmount),
  view: useAtomValue(earnEntryFacade.view),
});

export const useEarnPageStatus = () => ({
  retry: useAtomSet(earnPageStatusFacade.retry),
  view: useAtomValue(earnPageStatusFacade.view),
});
