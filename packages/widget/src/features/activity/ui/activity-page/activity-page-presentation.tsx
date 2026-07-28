import { Match } from "effect";
import { useTranslation } from "react-i18next";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../../services/workflow/transaction-workflow-model";
import { VirtualList } from "../../../../shared/ui/components/virtual-list";
import { Box } from "../../../../shared/ui/primitives/box";
import { Button } from "../../../../shared/ui/primitives/button";
import { ContentLoaderSquare } from "../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { FallbackContent } from "../../../widget-shell/components";
import type { ActivityActionItem } from "../../model/activity-action";
import type { ActivityFilter } from "../../model/filters";
import type {
  ActivityPagePagination,
  ActivityPageView,
} from "../../state/page";
import { ActionListItem } from "./components/action-list-item";
import { ActivityFilters } from "./components/activity-filters";
import { container } from "./style.css";

type ActivityPageReadyView = Extract<ActivityPageView, { status: "ready" }>;

const ActivityPageSkeleton = () => (
  <Box
    aria-hidden="true"
    data-rk="activity-page-skeleton"
    display="flex"
    gap="1"
    flexDirection="column"
  >
    {[...Array(5).keys()].map((item) => (
      <ContentLoaderSquare key={item} heightPx={60} />
    ))}
  </Box>
);

const ActivityPageError = ({
  dataRk,
  onRetry,
}: {
  readonly dataRk: string;
  readonly onRetry: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box
      alignItems="center"
      data-rk={dataRk}
      display="flex"
      flexDirection="column"
      gap="2"
      justifyContent="center"
      my="4"
    >
      <Text variant={{ type: "danger" }} textAlign="center">
        {t("shared.something_went_wrong")}
      </Text>
      <Button onClick={onRetry}>{t("shared.retry")}</Button>
    </Box>
  );
};

const resolveInfiniteScroll = (
  pagination: ActivityPagePagination
): {
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
} =>
  Match.value(pagination).pipe(
    Match.when({ status: "idle" }, () => ({
      hasNextPage: true,
      isFetchingNextPage: false,
    })),
    Match.when({ status: "loading-more" }, () => ({
      hasNextPage: true,
      isFetchingNextPage: true,
    })),
    Match.when({ status: "complete" }, () => ({
      hasNextPage: false,
      isFetchingNextPage: false,
    })),
    Match.when({ status: "load-more-failed" }, () => ({
      hasNextPage: false,
      isFetchingNextPage: false,
    })),
    Match.exhaustive
  );

const ReadyActivityPage = ({
  onActionSelect,
  onFilterSelect,
  onLoadMore,
  view,
}: {
  readonly onActionSelect: (
    item: ActivityActionItem,
    providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>
  ) => void;
  readonly onFilterSelect: (filter: ActivityFilter) => void;
  readonly onLoadMore: () => void;
  readonly view: ActivityPageReadyView;
}) => {
  const { t } = useTranslation();
  const infiniteScroll = resolveInfiniteScroll(view.pagination);

  return (
    <Box display="flex" flexDirection="column">
      <ActivityFilters
        options={view.filterOptions}
        selectedFilter={view.selectedFilter}
        onSelect={onFilterSelect}
      />

      {view.actions.length > 0 ? (
        <>
          <Box display="flex" justifyContent="flex-end" paddingBottom="2">
            <Text
              variant={{
                type: "muted",
                weight: "normal",
                size: "small",
              }}
            >
              {t("activity.showing_count", {
                showing: view.showingCount,
                total: view.total,
              })}
            </Text>
          </Box>

          <VirtualList
            data={view.actions}
            hasNextPage={infiniteScroll.hasNextPage}
            isFetchingNextPage={infiniteScroll.isFetchingNextPage}
            fetchNextPage={onLoadMore}
            estimateSize={() => 80}
            itemContent={(_index, item) => (
              <ActionListItem onActionSelect={onActionSelect} action={item} />
            )}
          />

          {view.pagination.status === "load-more-failed" && (
            <ActivityPageError
              dataRk="activity-load-more-error"
              onRetry={onLoadMore}
            />
          )}
        </>
      ) : (
        <Box my="4">
          <FallbackContent type="no_previous_activity" />
        </Box>
      )}
    </Box>
  );
};

export const ActivityPagePresentation = ({
  onActionSelect,
  onFilterSelect,
  onLoadMore,
  onRetry,
  view,
}: {
  readonly onActionSelect: (
    item: ActivityActionItem,
    providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>
  ) => void;
  readonly onFilterSelect: (filter: ActivityFilter) => void;
  readonly onLoadMore: () => void;
  readonly onRetry: () => void;
  readonly view: ActivityPageView;
}) => {
  const { t } = useTranslation();

  const content = Match.value(view).pipe(
    Match.when({ status: "connect-wallet" }, () => (
      <Box
        alignItems="center"
        data-rk="activity-connect-wallet"
        display="flex"
        flex={1}
        justifyContent="center"
      >
        <Text variant={{ weight: "medium", size: "large" }} textAlign="center">
          {t("dashboard.details.activity_connect_wallet")}
        </Text>
      </Box>
    )),
    Match.when({ status: "connecting" }, () => <ActivityPageSkeleton />),
    Match.when({ status: "loading" }, () => <ActivityPageSkeleton />),
    Match.when({ status: "failed" }, () => (
      <ActivityPageError dataRk="activity-page-error" onRetry={onRetry} />
    )),
    Match.when({ status: "empty" }, () => (
      <Box my="4">
        <FallbackContent type="no_previous_activity" />
      </Box>
    )),
    Match.when({ status: "ready" }, (readyView) => (
      <ReadyActivityPage
        onActionSelect={onActionSelect}
        onFilterSelect={onFilterSelect}
        onLoadMore={onLoadMore}
        view={readyView}
      />
    )),
    Match.exhaustive
  );

  return (
    <Box className={container} display="flex" flex={1} flexDirection="column">
      {content}
    </Box>
  );
};
