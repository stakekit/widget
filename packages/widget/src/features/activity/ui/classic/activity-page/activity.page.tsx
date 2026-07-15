import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { VirtualList } from "../../../../../shared/ui/components/virtual-list";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useMountAnimation } from "../../../../mount-animation";
import { FallbackContent, PageContainer } from "../../../../widget-shell";
import { ActionListItem } from "./components/action-list-item";
import { ActivityFilters } from "./components/activity-filters";
import { useActivityPage } from "./hooks/use-activity-page";
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
        <ActivityPageComponent />
      </PageContainer>
    </motion.div>
  );
};
