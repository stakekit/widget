import { useConnectModal } from "@stakekit/rainbowkit";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  ActionStatus,
  type TransactionType,
} from "../../../../../../domain/types/action";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../../../../services/workflow/transaction-workflow-model";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import { useTrackPage } from "../../../../../tracking";
import { useSKWallet } from "../../../../../wallet";
import { FallbackContent } from "../../../../../widget-shell";
import type {
  ActivityFilter,
  ActivityFilterOption,
} from "../../../../model/filters";
import {
  useActivityActions,
  useActivityFilterOptions,
  usePrefetchActivityActionFilters,
} from "../../../../react/use-activity-actions";
import { useActivityFilter } from "../../../../react/use-activity-filter";
import { useSetActivitySelection } from "../../../../react/use-activity-selection";
import type { ActionYieldDto } from "../types";

type UseActivityPageResult = {
  content: ReactNode;
  onActionSelect: (
    val: ActionYieldDto,
    providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>
  ) => void;
  showingCount: number;
  total: number;
  allData: ReturnType<typeof useActivityActions>["allItems"];
  filterOptions: ActivityFilterOption[];
  selectedFilter: ActivityFilter;
  onFilterSelect: (filter: ActivityFilter) => void;
  activityActions: ReturnType<typeof useActivityActions>;
  showActivityContent: boolean;
  showActivityControls: boolean;
  showActivityList: boolean;
};

export const useActivityPage = ({
  selectionMode = "navigate",
}: {
  readonly selectionMode?: "navigate" | "select";
} = {}): UseActivityPageResult => {
  useTrackPage("activity");

  const { isConnected, isConnecting } = useSKWallet();
  const { openConnectModal } = useConnectModal();
  const navigate = useNavigate();
  const setActivitySelection = useSetActivitySelection();
  const filterOptions = useActivityFilterOptions();
  const { selectedFilter, setSelectedFilter } =
    useActivityFilter(filterOptions);
  const activityActions = useActivityActions(selectedFilter);
  usePrefetchActivityActionFilters();

  const onActionSelect = (
    data: ActionYieldDto,
    providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>
  ) => {
    if (!isConnected) return openConnectModal?.();
    if (!data.yieldData) return;

    setActivitySelection({
      providersDetails,
      selectedAction: data.actionData,
      selectedYield: data.yieldData,
      selectedValidators: data.validatorsData,
      walletScope: data.walletScope,
    });

    if (selectionMode === "select") return;

    if (
      data.actionData.status === ActionStatus.SUCCESS ||
      data.actionData.status === ActionStatus.PROCESSING
    ) {
      const urls = data.actionData.transactions
        .map((transaction) => ({
          type: transaction.type,
          url: transaction.explorerUrl,
        }))
        .filter(
          (
            transaction
          ): transaction is {
            type: TransactionType;
            url: string;
          } => !!transaction.url
        );
      const path =
        data.actionData.type === "UNSTAKE"
          ? "unstake"
          : data.actionData.type === "STAKE"
            ? "stake"
            : "pending";

      return navigate(`/activity/${path}-review/complete`, {
        state: { urls },
      });
    }

    if (
      data.actionData.status === ActionStatus.CREATED ||
      data.actionData.status === ActionStatus.WAITING_FOR_NEXT ||
      data.actionData.status === ActionStatus.FAILED
    ) {
      return navigate("/activity/review");
    }
  };

  const allData = activityActions.allItems;

  const showingCount = allData?.length ?? 0;

  const apiTotal =
    (activityActions.data as { pages: { total?: number }[] } | undefined)
      ?.pages?.[0]?.total ??
    allData?.length ??
    0;
  const total = apiTotal;
  const hasRenderableActivity = !!allData?.length;
  const hasActivityFilters = filterOptions.length > 0;
  const showActivityControls = !activityActions.isPending && hasActivityFilters;
  const showActivityList = !activityActions.isPending && hasRenderableActivity;
  const showActivityContent = showActivityControls || showActivityList;

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

    if (isConnected && !showActivityContent && !activityActions.isPending) {
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
    showActivityContent,
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
    filterOptions,
    selectedFilter,
    onFilterSelect: setSelectedFilter,
    activityActions,
    showActivityContent,
    showActivityControls,
    showActivityList,
  };
};
