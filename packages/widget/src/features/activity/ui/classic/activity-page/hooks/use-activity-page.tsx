import { useAtomSet } from "@effect/atom-react";
import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../../../../services/workflow/transaction-workflow-model";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import { useTrackPage } from "../../../../../tracking/react/use-track-page";
import { useSKWallet } from "../../../../../wallet/react/use-wallet";
import { FallbackContent } from "../../../../../widget-shell/fallback-content";
import {
  useActivityActions,
  useActivityFilterOptions,
} from "../../../../react/use-activity-actions";
import { useActivityFilter } from "../../../../react/use-activity-filter";
import { resumeActivityActionAtom } from "../../../../state/resume-action";
import type { ActionYieldDto } from "../types";

export const useActivityPage = ({
  selectionMode = "navigate",
}: {
  readonly selectionMode?: "navigate" | "select";
} = {}) => {
  useTrackPage("activity");

  const { isConnected, isConnecting } = useSKWallet();
  const resumeActivityAction = useAtomSet(resumeActivityActionAtom);
  const filterOptionsResult = useActivityFilterOptions();
  const filterOptions = filterOptionsResult.pipe(
    AsyncResult.value,
    Option.getOrElse(() => [])
  );
  const { selectedFilter, setSelectedFilter } =
    useActivityFilter(filterOptions);
  const activityActions = useActivityActions(selectedFilter);

  const onActionSelect = (
    data: ActionYieldDto,
    providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>
  ) =>
    resumeActivityAction({
      action: data.actionData,
      providersDetails,
      selectionMode,
      validators: data.validatorsData,
      walletScope: data.walletScope,
      yield: data.yieldData,
    });

  const activityValue = activityActions.result.pipe(
    AsyncResult.value,
    Option.getOrUndefined
  );
  const allData = activityValue
    ? EArray.flatMap(activityValue.items, (batch) => batch.actions)
    : [];
  const showingCount = allData.length;
  const total = activityValue?.items.at(-1)?.total ?? allData.length;
  const hasNextPage = activityValue !== undefined && !activityValue.done;
  const isFetchingNextPage =
    activityActions.result.waiting && allData.length > 0;
  const isPending = AsyncResult.isInitial(activityActions.result);
  const onLoadMore = () => {
    if (!activityActions.result.waiting && hasNextPage) activityActions.pull();
  };
  const hasRenderableActivity = allData.length > 0;
  const hasActivityFilters = filterOptions.length > 0;
  const showActivityControls = !isPending && hasActivityFilters;
  const showActivityList = !isPending && hasRenderableActivity;
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

    if (isConnected && !showActivityContent && !isPending) {
      return (
        <Box my="4">
          <FallbackContent type="no_previous_activity" />
        </Box>
      );
    }

    if (isConnected && isPending && !isFetchingNextPage) {
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
    isPending,
    isFetchingNextPage,
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
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
    showActivityContent,
    showActivityControls,
    showActivityList,
  };
};
