import {
  earnYieldSelectionViewAtom,
  selectEarnCategoryAtom,
  selectEarnYieldAtom,
  setEarnYieldSearchAtom,
} from "./runtime";

export const yieldSelectionFacade = {
  select: selectEarnYieldAtom,
  selectCategory: selectEarnCategoryAtom,
  setSearch: setEarnYieldSearchAtom,
  view: earnYieldSelectionViewAtom,
} as const;
