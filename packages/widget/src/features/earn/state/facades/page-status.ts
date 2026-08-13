import { earnPageStatusViewAtom, retryEarnPageAtom } from "./runtime";

export const earnPageStatusFacade = {
  retry: retryEarnPageAtom,
  view: earnPageStatusViewAtom,
} as const;
