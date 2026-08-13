import {
  earnTokenSelectionViewAtom,
  loadMoreEarnTokensAtom,
  selectEarnTokenAtom,
  setEarnTokenSearchAtom,
} from "./runtime";

export const tokenSelectionFacade = {
  loadMore: loadMoreEarnTokensAtom,
  select: selectEarnTokenAtom,
  setSearch: setEarnTokenSearchAtom,
  view: earnTokenSelectionViewAtom,
} as const;
