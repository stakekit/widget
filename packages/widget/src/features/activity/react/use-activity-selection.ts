import { useAtomSet, useAtomValue } from "@effect/atom-react";
import {
  activitySelectedActionAtom,
  activitySelectedValidatorsAtom,
  activitySelectedYieldAtom,
  activitySelectionAtom,
} from "../state/selection";

export const useActivitySelectedAction = () =>
  useAtomValue(activitySelectedActionAtom);

export const useActivitySelectedYield = () =>
  useAtomValue(activitySelectedYieldAtom);

export const useActivitySelectedValidators = () =>
  useAtomValue(activitySelectedValidatorsAtom);

export const useSetActivitySelection = () => useAtomSet(activitySelectionAtom);
