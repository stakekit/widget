import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../../components/atoms/content-loader";
import { Text } from "../../../../components/atoms/typography/text";
import { useTrackPage } from "../../../../hooks/tracking/use-track-page";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { FallbackContent } from "../../positions-page/components/fallback-content";
import type { ActivityFilter } from "../activity-filters";
import { useActivityPageContext } from "../state/activity-page.context";
import type { ActionYieldDto } from "../types";
import {
  type ActivityFilterOption,
  useActivityFilters,
} from "./use-activity-filters";

type UseActivityPageResult = {
  content: ReactNode;
  onActionSelect: (val: ActionYieldDto) => void;
  showingCount: number;
  total: number;
  allData: ReturnType<
    typeof useActivityPageContext
  >["activityActions"]["allItems"];
  filteredData: ReturnType<
    typeof useActivityPageContext
  >["activityActions"]["allItems"];
  filterOptions: ActivityFilterOption[];
  selectedFilter: ActivityFilter;
  onFilterSelect: (filter: ActivityFilter) => void;
  activityActions: ReturnType<typeof useActivityPageContext>["activityActions"];
};

export const useActivityPage = (): UseActivityPageResult => {
  useTrackPage("activity");

  const { isConnected, isConnecting } = useSKWallet();

  const { activityActions, onActionSelect } = useActivityPageContext();

  const allData = activityActions.allItems;

  const {
    selectedFilter,
    setSelectedFilter,
    options: filterOptions,
    filteredData,
    filteredCount,
  } = useActivityFilters(allData);

  const showingCount = filteredCount;

  const apiTotal =
    (activityActions.data as { pages: { total?: number }[] } | undefined)
      ?.pages?.[0]?.total ??
    allData?.length ??
    0;

  // When a category filter is active we can only count loaded items, so the
  // total reflects the filtered subset instead of the API-reported total.
  const total = selectedFilter === "all" ? apiTotal : filteredCount;

  const { t } = useTranslation();

  const content = useMemo(() => {
    if (!isConnected && !isConnecting) {
      return (
        <Box
          display="flex"
          flex={1}
          justifyContent="center"
          alignItems="center"
        >
          <Text
            variant={{ weight: "medium", size: "large" }}
            textAlign="center"
          >
            {t("dashboard.details.activity_connect_wallet")}
          </Text>
        </Box>
      );
    }

    if (isConnected && !allData?.length && !activityActions.isPending) {
      return (
        <Box my="4">
          <FallbackContent type="no_previous_activity" />
        </Box>
      );
    }

    if (
      isConnected &&
      activityActions.isPending &&
      !activityActions.isFetchingNextPage
    ) {
      return (
        <Box display="flex" gap="1" flexDirection="column">
          {[...Array(5).keys()].map((item) => (
            <ContentLoaderSquare key={item} heightPx={60} />
          ))}
        </Box>
      );
    }

    return null;
  }, [
    isConnected,
    isConnecting,
    allData,
    activityActions.isPending,
    activityActions.isFetchingNextPage,
    t,
  ]);

  return {
    content,
    onActionSelect,
    showingCount,
    total,
    allData,
    filteredData,
    filterOptions,
    selectedFilter,
    onFilterSelect: setSelectedFilter,
    activityActions,
  };
};
