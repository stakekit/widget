import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { VirtualList } from "../../../../../shared/ui/components/virtual-list";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useSKWallet } from "../../../../wallet";
import { FallbackContent } from "../../../../widget-shell";
import {
  useActivitySelectedAction,
  useSetActivitySelection,
} from "../../../react/use-activity-selection";
import { ActionListItem } from "../../classic/activity-page/components/action-list-item";
import { ActivityFilters } from "../../classic/activity-page/components/activity-filters";
import { useActivityPage } from "../../classic/activity-page/hooks/use-activity-page";
import { container } from "./styles.css";

const ActivityPageComponent = () => {
  const {
    content,
    allData,
    filterOptions,
    selectedFilter,
    onFilterSelect,
    showingCount,
    total,
    onActionSelect,
    activityActions,
    showActivityContent,
    showActivityControls,
    showActivityList,
  } = useActivityPage({ selectionMode: "select" });

  const { t } = useTranslation();

  return (
    <Box className={container} display="flex" flex={1} flexDirection="column">
      {content}

      <Box display="flex" flexDirection="column">
        {showActivityContent && (
          <>
            {showActivityControls && (
              <ActivityFilters
                options={filterOptions}
                selectedFilter={selectedFilter}
                onSelect={onFilterSelect}
              />
            )}

            {showActivityList ? (
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
                      showing: showingCount,
                      total,
                    })}
                  </Text>
                </Box>

                <VirtualList
                  data={allData ?? []}
                  hasNextPage={activityActions.hasNextPage}
                  isFetchingNextPage={activityActions.isFetchingNextPage}
                  fetchNextPage={activityActions.fetchNextPage}
                  estimateSize={() => 80}
                  itemContent={(_index, item) => (
                    <ActionListItem
                      onActionSelect={onActionSelect}
                      action={item}
                    />
                  )}
                />
              </>
            ) : (
              <Box my="4">
                <FallbackContent type="no_previous_activity" />
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

const _ActivityPage = () => {
  const setActivitySelection = useSetActivitySelection();
  const { isConnected, network } = useSKWallet();

  const selectedAction = useActivitySelectedAction();

  // biome-ignore lint: false
  useEffect(() => {
    setActivitySelection(null);
  }, [network, setActivitySelection]);

  useEffect(() => {
    if (!isConnected && selectedAction) {
      setActivitySelection(null);
    }
  }, [isConnected, selectedAction, setActivitySelection]);

  return <ActivityPageComponent />;
};

export const ActivityPage = () => <_ActivityPage />;
