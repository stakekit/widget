import {
  earnValidatorModalEventAtom,
  earnValidatorSelectionViewAtom,
  loadMoreEarnValidatorsAtom,
  removeEarnValidatorAtom,
  selectEarnValidatorAtom,
  setEarnValidatorSearchAtom,
} from "./runtime";

export const validatorSelectionFacade = {
  loadMore: loadMoreEarnValidatorsAtom,
  recordModalEvent: earnValidatorModalEventAtom,
  remove: removeEarnValidatorAtom,
  select: selectEarnValidatorAtom,
  setSearch: setEarnValidatorSearchAtom,
  view: earnValidatorSelectionViewAtom,
} as const;
