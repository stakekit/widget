import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { activitySelectionAtom } from "../state/selection";

export const useActivitySelection = () => useAtomValue(activitySelectionAtom);

export const useSetActivitySelection = () => useAtomSet(activitySelectionAtom);
