import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { activityResumeDashboardCommandAtom } from "../state/classic-transaction-flow";

export const useAbandonActivityResume = () =>
  useAtomSet(useAtomValue(activityResumeDashboardCommandAtom));
