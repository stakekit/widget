import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { EarnYieldWithProvider } from "../../../domain/earn/models";
import type { YieldId } from "../../../domain/identity/identifiers";
import {
  hideEarnTokenBalanceAtom,
  revealEarnTokenBalanceAtom,
  revealEarnTokenBalanceStatusAtom,
} from "../state/confidential";
import type { EarnProviderOption } from "../state/earn-selection/types";
import {
  earnEntryViewAtom,
  earnProviderOptionsViewAtom,
  refreshEarnKycAtom,
  runEarnPrimaryActionAtom,
  selectEarnProviderOptionAtom,
  selectEarnTronResourceAtom,
  setEarnAmountAtom,
  setEarnMaxAmountAtom,
} from "../state/entry";
import {
  earnFlowProviderOptionAtom,
  earnFlowYieldAtom,
} from "../state/flow-target";
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

/** Selects a dashboard yield category without subscribing to the selection. */
export const useSelectEarnCategory = () => useAtomSet(selectEarnCategoryAtom);

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
  hideTokenBalance: useAtomSet(hideEarnTokenBalanceAtom),
  revealTokenBalance: useAtomSet(revealEarnTokenBalanceAtom),
  revealTokenBalanceStatus: useAtomValue(revealEarnTokenBalanceStatusAtom),
  runPrimaryAction: useAtomSet(runEarnPrimaryActionAtom),
  selectTronResource: useAtomSet(selectEarnTronResourceAtom),
  setAmount: useAtomSet(setEarnAmountAtom),
  setMaxAmount: useAtomSet(setEarnMaxAmountAtom),
  view: useAtomValue(earnEntryViewAtom),
});

export const useEarnProviderOptions = () => ({
  select: useAtomSet(selectEarnProviderOptionAtom),
  view: useAtomValue(earnProviderOptionsViewAtom),
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

export const useEarnFlowYield = (captured: EarnYieldWithProvider) =>
  useAtomValue(earnFlowYieldAtom(captured));

export const useEarnFlowProviderOption = (captured: EarnProviderOption) =>
  useAtomValue(earnFlowProviderOptionAtom(captured));
