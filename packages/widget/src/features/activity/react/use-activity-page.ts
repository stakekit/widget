import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useNavigate, useParams } from "react-router";
import type { ActivityActionItem } from "../model/activity-action";
import {
  parseActivityRouteIntent,
  resolveActivityHighlightActionId,
} from "../state/details";
import {
  activityPageViewAtom,
  loadMoreActivityAtom,
  retryActivityPageAtom,
  setActivityPageFilterAtom,
} from "../state/page";

export const useActivityPage = ({
  allowDefaultSelection = false,
}: {
  readonly allowDefaultSelection?: boolean;
} = {}) => {
  const navigate = useNavigate();
  const { actionId: actionIdParam } = useParams();
  const view = useAtomValue(activityPageViewAtom);
  const loadMore = useAtomSet(loadMoreActivityAtom);
  const retry = useAtomSet(retryActivityPageAtom);
  const selectFilter = useAtomSet(setActivityPageFilterAtom);
  const parsed = parseActivityRouteIntent({
    actionIdParam,
    allowDefault: allowDefaultSelection,
  });
  const selectedActionId = resolveActivityHighlightActionId(
    parsed.status === "ok" ? parsed.intent : null,
    view
  );

  return {
    view,
    selectedActionId,
    onActionSelect: (item: ActivityActionItem) =>
      navigate(`/activity/${encodeURIComponent(item.actionData.id)}`),
    onFilterSelect: selectFilter,
    onLoadMore: () => loadMore(undefined),
    onRetry: () => retry(undefined),
  } as const;
};
