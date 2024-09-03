import { Box } from "@sk-widget/components";
import { ContentLoaderSquare } from "@sk-widget/components/atoms/content-loader";
import { VirtualList } from "@sk-widget/components/atoms/virtual-list";
import { useTrackPage } from "@sk-widget/hooks/tracking/use-track-page";
import ActionListItem from "@sk-widget/pages/details/activity-page/components/action-list-item";
import {
  ActivityPageContextProvider,
  useActivityPageContext,
} from "@sk-widget/pages/details/activity-page/state/activiti-page.context";
import { useMountAnimation } from "@sk-widget/providers/mount-animation";
import { motion } from "framer-motion";
import { PageContainer } from "../../components";
import { container } from "./style.css";

export const ActivityPageComponent = () => {
  useTrackPage("activity");

  const { mountAnimationFinished } = useMountAnimation();
  const { activityActions, onActionSelect } = useActivityPageContext();

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
        <Box
          className={container}
          display="flex"
          flex={1}
          flexDirection="column"
        >
          {activityActions.isPending ? (
            <Box display="flex" gap="1" flexDirection="column">
              {[...Array(5).keys()].map((item) => (
                <ContentLoaderSquare key={item} heightPx={60} />
              ))}
            </Box>
          ) : (
            <Box display="flex" flexDirection="column">
              {activityActions.allItems ? (
                <VirtualList
                  fetchNextPage={activityActions.fetchNextPage}
                  hasNextPage={activityActions.hasNextPage}
                  isFetchingNextPage={activityActions.isFetchingNextPage}
                  data={activityActions.allItems}
                  estimateSize={() => 60}
                  itemContent={(_index, item) => (
                    <ActionListItem
                      onActionSelect={onActionSelect}
                      action={item}
                    />
                  )}
                />
              ) : (
                "No Data"
              )}
            </Box>
          )}
        </Box>
      </PageContainer>
    </motion.div>
  );
};

export const ActivityPage = () => (
  <ActivityPageContextProvider>
    <ActivityPageComponent />
  </ActivityPageContextProvider>
);
