import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { Text } from "../../../components/atoms/typography/text";
import { VirtualList } from "../../../components/atoms/virtual-list";
import { useMountAnimation } from "../../../providers/mount-animation";
import { PageContainer } from "../../components/page-container";
import { FallbackContent } from "../positions-page/components/fallback-content";
import { ActionListItem } from "./components/action-list-item";
import { ActivityFilters } from "./components/activity-filters";
import { useActivityPage } from "./hooks/use-activity-page";
import { ActivityPageContextProvider } from "./state/activity-page.context";
import { container } from "./style.css";

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
  } = useActivityPage();

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

export const AnimatedActivityPage = () => {
  const { mountAnimationFinished } = useMountAnimation();

  return (
    <motion.div
      initial={{ opacity: 0, translateY: "-10px" }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{
        duration: mountAnimationFinished ? 0.3 : 1,
        delay: mountAnimationFinished ? 0 : 1.5,
      }}
    >
      <PageContainer>
        <ActivityPageContextProvider>
          <ActivityPageComponent />
        </ActivityPageContextProvider>
      </PageContainer>
    </motion.div>
  );
};
