import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { YieldId } from "../../../domain/identity/identifiers";
import {
  earnEntryViewAtom,
  refreshEarnKycAtom,
  runEarnPrimaryActionAtom,
  selectEarnProviderAtom,
  selectEarnTronResourceAtom,
  setEarnAmountAtom,
  setEarnMaxAmountAtom,
} from "../state/entry";
import { earnPageStatusViewAtom } from "../state/page-status";
import {
  earnTokenSelectionViewAtom,
  selectEarnTokenAtom,
  setEarnTokenSearchAtom,
} from "../state/token-selection";
import {
  earnValidatorModalEventAtom,
  earnValidatorSelectionViewAtom,
  loadMoreEarnValidatorsAtom,
  removeEarnValidatorAtom,
  selectEarnValidatorAtom,
  setEarnValidatorSearchAtom,
} from "../state/validator-selection";
import {
  earnRewardRateHistoryChart,
  earnTvlHistoryChart,
} from "../state/yield-history-charts";
import {
  earnYieldSelectionViewAtom,
  selectEarnCategoryAtom,
  selectEarnYieldAtom,
  setEarnYieldSearchAtom,
} from "../state/yield-selection";

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

export const useEarnRewardRateHistoryChart = (yieldId: YieldId | null) => ({
  selectPeriod: useAtomSet(earnRewardRateHistoryChart.selectPeriodAtom),
  view: useAtomValue(earnRewardRateHistoryChart.viewAtom(yieldId)),
});

export const useEarnTvlHistoryChart = (yieldId: YieldId | null) => ({
  selectPeriod: useAtomSet(earnTvlHistoryChart.selectPeriodAtom),
  view: useAtomValue(earnTvlHistoryChart.viewAtom(yieldId)),
});
