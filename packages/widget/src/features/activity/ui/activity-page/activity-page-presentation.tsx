import { useAtomValue } from "@effect/atom-react";
import { Match } from "effect";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import { presentationClockAtom } from "../../../../shared/effect/presentation-clock";
import {
  EmptyState,
  ListSkeleton,
  Stack,
  Text,
  VirtualList,
} from "../../../../ui/index";
import { useWidgetNavigate } from "../../../navigation/index";
import { ConnectWalletState } from "../../../wallet/views";
import {
  type ActivityActionItem,
  type ActivitySelectionTarget,
  isActivitySelectionTarget,
} from "../../model/activity-action";
import {
  type ActivityDayLabel,
  groupActivityActionsByDay,
} from "../../model/activity-days";
import type { ActivityFilter } from "../../model/filters";
import type {
  ActivityPagePagination,
  ActivityPageView,
} from "../../state/page";
import { ActivityRetryMessage } from "../components/activity-retry-message";
import { ActionListItem } from "./components/action-list-item";
import { ActivityFilters } from "./components/activity-filters";

type ActivityPageReadyView = Extract<ActivityPageView, { status: "ready" }>;

const ActivityPageSkeleton = () => {
  const { t } = useTranslation();

  return (
    <ListSkeleton
      testId="activity-page-skeleton"
      label={t("activity.loading")}
    />
  );
};

const ActivityPageError = ({
  testId,
  onRetry,
  fill = false,
}: {
  readonly testId: string;
  readonly onRetry: () => void;
  readonly fill?: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <Stack align="stretch" justify="center" grow={fill} testId={testId}>
      <ActivityRetryMessage
        onRetry={onRetry}
        fill={fill}
        title={t("activity.load_failed_title")}
      />
    </Stack>
  );
};

/** No activity at all: it leads to Earn, where activity starts. */
const ActivityPageEmpty = () => {
  const { t } = useTranslation();
  const navigation = useWidgetNavigate();

  return (
    <EmptyState
      fill
      testId="activity-empty"
      icon="HistoryIcon"
      title={t("activity.empty_title")}
      body={t("activity.empty_description")}
      action={{
        label: t("shared.start_earning"),
        onClick: () => void navigation.push(widgetRoutes.earn.build()),
      }}
    />
  );
};

const resolveInfiniteScroll = (
  pagination: ActivityPagePagination
): {
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
} =>
  Match.value(pagination).pipe(
    Match.when({ status: "idle" }, () => ({
      hasMore: true,
      loadingMore: false,
    })),
    Match.when({ status: "loading-more" }, () => ({
      hasMore: true,
      loadingMore: true,
    })),
    Match.when({ status: "complete" }, () => ({
      hasMore: false,
      loadingMore: false,
    })),
    Match.when({ status: "load-more-failed" }, () => ({
      hasMore: false,
      loadingMore: false,
    })),
    Match.exhaustive
  );

/**
 * The feed under a sticky header per day. It starts at its top for each
 * filter: a filter's list is a new list, not a scrolled one.
 */
const ActivityList = ({
  onActionSelect,
  onLoadMore,
  selectedAction,
  view,
}: {
  readonly onActionSelect: (item: ActivityActionItem) => void;
  readonly onLoadMore: () => void;
  readonly selectedAction: ActivitySelectionTarget | null;
  readonly view: ActivityPageReadyView;
}) => {
  const { t, i18n } = useTranslation();
  const presentationTime = useAtomValue(presentationClockAtom);
  const infiniteScroll = resolveInfiniteScroll(view.pagination);
  const dayLabel = (day: ActivityDayLabel) =>
    Match.value(day).pipe(
      Match.when({ _tag: "today" }, () => t("activity.groups.today")),
      Match.when({ _tag: "yesterday" }, () => t("activity.groups.yesterday")),
      Match.when({ _tag: "date" }, ({ label }) => label),
      Match.exhaustive
    );
  const list = {
    label: t("activity.list_label"),
    getKey: (item: ActivityActionItem) => `${item._tag}:${item.actionData.id}`,
    hasMore: infiniteScroll.hasMore,
    loadingMore: infiniteScroll.loadingMore,
    loadingMoreLabel: t("activity.loading_more"),
    onEndReached: onLoadMore,
    estimateSize: 72,
    maxHeight: "lg",
    grow: true,
    renderItem: (item: ActivityActionItem): ReactNode => (
      <ActionListItem
        action={item}
        isSelected={isActivitySelectionTarget(item, selectedAction)}
        onActionSelect={onActionSelect}
      />
    ),
  } as const;

  // Days need the presentation zone; until it is known the feed is one run.
  return presentationTime ? (
    <VirtualList
      key={view.selectedFilter}
      {...list}
      groups={groupActivityActionsByDay({
        actions: view.actions,
        locale: i18n.language,
        presentationTime,
      }).map(({ day, items, key }) => ({
        items,
        key,
        label: dayLabel(day),
      }))}
      stickyHeaders
    />
  ) : (
    <VirtualList key={view.selectedFilter} {...list} items={view.actions} />
  );
};

const ReadyActivityPage = ({
  onActionSelect,
  onFilterSelect,
  onLoadMore,
  selectedAction,
  view,
}: {
  readonly onActionSelect: (item: ActivityActionItem) => void;
  readonly onFilterSelect: (filter: ActivityFilter) => void;
  readonly onLoadMore: () => void;
  readonly selectedAction: ActivitySelectionTarget | null;
  readonly view: ActivityPageReadyView;
}) => {
  const { t } = useTranslation();
  // Once every action is on screen the count says nothing the list does not.
  const showsCount =
    view.pagination.status !== "complete" && view.showingCount < view.total;

  return (
    <Stack grow gap={12}>
      <ActivityFilters
        options={view.filterOptions}
        selectedFilter={view.selectedFilter}
        onSelect={onFilterSelect}
      />

      {view.actions.length > 0 ? (
        <Stack grow gap={8}>
          {showsCount ? (
            <Stack direction="row" justify="end">
              <Text variant="caption" tone="muted">
                {t("activity.showing_count", {
                  showing: view.showingCount,
                  total: view.total,
                })}
              </Text>
            </Stack>
          ) : null}

          <ActivityList
            onActionSelect={onActionSelect}
            onLoadMore={onLoadMore}
            selectedAction={selectedAction}
            view={view}
          />

          {view.pagination.status === "load-more-failed" && (
            <ActivityPageError
              testId="activity-load-more-error"
              onRetry={onLoadMore}
            />
          )}
        </Stack>
      ) : (
        <EmptyState
          testId="activity-filter-empty"
          icon="HistoryIcon"
          title={t("activity.filter_empty_title")}
        />
      )}
    </Stack>
  );
};

export const ActivityPagePresentation = ({
  onActionSelect,
  onFilterSelect,
  onLoadMore,
  onRetry,
  selectedAction = null,
  view,
}: {
  readonly onActionSelect: (item: ActivityActionItem) => void;
  readonly onFilterSelect: (filter: ActivityFilter) => void;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
  readonly selectedAction?: ActivitySelectionTarget | null;
  readonly view: ActivityPageView;
}) => {
  const { t } = useTranslation();

  const content = Match.value(view).pipe(
    Match.when({ status: "connect-wallet" }, () => (
      <ConnectWalletState
        testId="activity-connect-wallet"
        title={t("dashboard.details.activity_connect_wallet")}
      />
    )),
    Match.when({ status: "connecting" }, () => <ActivityPageSkeleton />),
    Match.when({ status: "loading" }, () => <ActivityPageSkeleton />),
    Match.when({ status: "failed" }, () => (
      <ActivityPageError fill testId="activity-page-error" onRetry={onRetry} />
    )),
    Match.when({ status: "empty" }, () => <ActivityPageEmpty />),
    Match.when({ status: "ready" }, (readyView) => (
      <ReadyActivityPage
        onActionSelect={onActionSelect}
        onFilterSelect={onFilterSelect}
        onLoadMore={onLoadMore}
        selectedAction={selectedAction}
        view={readyView}
      />
    )),
    Match.exhaustive
  );

  return <Stack grow>{content}</Stack>;
};
