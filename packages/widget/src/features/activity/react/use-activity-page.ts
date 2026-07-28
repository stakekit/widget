import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../services/workflow/transaction-workflow-model";
import type { ActivityActionItem } from "../model/activity-action";
import {
  activityPageViewAtom,
  loadMoreActivityAtom,
  retryActivityPageAtom,
  setActivityPageFilterAtom,
} from "../state/page";
import {
  type ActivityResumeMode,
  startActivityResumeAtom,
} from "../state/start-activity-resume";

export const useActivityPage = ({
  resumeMode,
}: {
  readonly resumeMode: ActivityResumeMode;
}) => {
  const view = useAtomValue(activityPageViewAtom);
  const loadMore = useAtomSet(loadMoreActivityAtom);
  const retry = useAtomSet(retryActivityPageAtom);
  const startActivityResume = useAtomSet(startActivityResumeAtom);
  const selectFilter = useAtomSet(setActivityPageFilterAtom);

  return {
    view,
    onActionSelect: (
      item: ActivityActionItem,
      providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>
    ) => startActivityResume({ item, mode: resumeMode, providersDetails }),
    onFilterSelect: selectFilter,
    onLoadMore: () => loadMore(undefined),
    onRetry: () => retry(undefined),
  } as const;
};
