import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useMatch, useNavigate, useParams } from "react-router";
import {
  type ActivityActionItem,
  getActivityActionPath,
  getActivitySelectionTarget,
} from "../model/activity-action";
import {
  parseActivityRouteIntent,
  resolveActivityHighlightAction,
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
  const borrowMatch = useMatch("/activity/borrow/:actionId");
  const view = useAtomValue(activityPageViewAtom);
  const loadMore = useAtomSet(loadMoreActivityAtom);
  const retry = useAtomSet(retryActivityPageAtom);
  const selectFilter = useAtomSet(setActivityPageFilterAtom);
  const parsed = parseActivityRouteIntent({
    actionIdParam,
    allowDefault: allowDefaultSelection,
    source: borrowMatch ? "borrow" : "yield",
  });
  const selectedAction = resolveActivityHighlightAction(
    parsed.status === "ok" ? parsed.intent : null,
    view
  );

  return {
    view,
    selectedAction,
    onActionSelect: (item: ActivityActionItem) =>
      navigate(getActivityActionPath(getActivitySelectionTarget(item))),
    onFilterSelect: selectFilter,
    onLoadMore: () => loadMore(undefined),
    onRetry: () => retry(undefined),
  } as const;
};
