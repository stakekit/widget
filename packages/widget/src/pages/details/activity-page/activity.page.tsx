import { Box, Text } from "@sk-widget/components";
import { ContentLoaderSquare } from "@sk-widget/components/atoms/content-loader";
import { GroupedVirtualList } from "@sk-widget/components/atoms/virtual-list";
import { dateGroupLabels } from "@sk-widget/domain/types/date-group-labels";
import { useTrackPage } from "@sk-widget/hooks/tracking/use-track-page";
import ActionListItem from "@sk-widget/pages/details/activity-page/components/action-list-item";
import {
  ActivityPageContextProvider,
  useActivityPageContext,
} from "@sk-widget/pages/details/activity-page/state/activiti-page.context";
import { FallbackContent } from "@sk-widget/pages/details/positions-page/components/fallback-content";
import { useMountAnimation } from "@sk-widget/providers/mount-animation";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components";
import { container } from "./style.css";

export const ActivityPageComponent = () => {
  useTrackPage("activity");

  const { t } = useTranslation();
  const { isConnected, isConnecting } = useSKWallet();

  const { mountAnimationFinished } = useMountAnimation();
  const { activityActions, onActionSelect, labels, counts } =
    useActivityPageContext();
  const allData = activityActions.allItems;

  const content = useMemo(() => {
    if (!isConnected && !isConnecting) {
      return <FallbackContent type="not_connected" />;
    }

    if (isConnected && !allData?.length && !activityActions.isPending) {
      return (
        <Box my="4">
          <FallbackContent type="no_current_positions" />
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
  ]);

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
          {content}

          <Box display="flex" flexDirection="column">
            {!activityActions.isPending && allData && (
              <GroupedVirtualList
                hasNextPage={activityActions.hasNextPage}
                isFetchingNextPage={activityActions.isFetchingNextPage}
                fetchNextPage={activityActions.fetchNextPage}
                estimateSize={() => 60}
                groupCounts={counts}
                groupContent={(index) => {
                  return (
                    <Box py="4" background="modalBodyBackground">
                      <Text variant={{ weight: "bold" }}>
                        {dateGroupLabels(labels[index], t)}
                      </Text>
                    </Box>
                  );
                }}
                itemContent={(index) => {
                  const item = allData[index];

                  return (
                    <ActionListItem
                      onActionSelect={onActionSelect}
                      action={item}
                    />
                  );
                }}
              />
            )}
          </Box>
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
