import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { activityResumeDashboardCommandAtom } from "../state/atoms/classic-flow";

export const useAbandonActivityResume = () =>
  useAtomSet(useAtomValue(activityResumeDashboardCommandAtom));
