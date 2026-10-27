import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { widgetRoutes } from "../../../services/navigation/widget-routes";
import {
  useWidgetNavigate,
  useWidgetRoutePrefixMatch,
} from "../../navigation/index";
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
  const navigation = useWidgetNavigate();
  const borrowMatch = useWidgetRoutePrefixMatch(
    widgetRoutes.activityBorrowAction
  );
  const yieldMatch = useWidgetRoutePrefixMatch(widgetRoutes.activityAction);
  const view = useAtomValue(activityPageViewAtom);
  const loadMore = useAtomSet(loadMoreActivityAtom);
  const retry = useAtomSet(retryActivityPageAtom);
  const selectFilter = useAtomSet(setActivityPageFilterAtom);
  const parsed = parseActivityRouteIntent({
    actionIdParam: borrowMatch?.actionId ?? yieldMatch?.actionId,
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
      navigation.push(getActivityActionPath(getActivitySelectionTarget(item))),
    onFilterSelect: selectFilter,
    onLoadMore: () => loadMore(undefined),
    onRetry: () => retry(undefined),
  } as const;
};
