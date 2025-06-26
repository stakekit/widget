import { Box } from "@sk-widget/components/atoms/box";
import { Text } from "@sk-widget/components/atoms/typography/text";
import { GroupedVirtualList } from "@sk-widget/components/atoms/virtual-list";
import { PageContainer } from "@sk-widget/pages/components/page-container";
import { ActionListItem } from "@sk-widget/pages/details/activity-page/components/action-list-item";
import ListItemBullet from "@sk-widget/pages/details/activity-page/components/list-item-bullet";
import { useActivityPage } from "@sk-widget/pages/details/activity-page/hooks/use-activity-page";
import { ActivityPageContextProvider } from "@sk-widget/pages/details/activity-page/state/activity-page.context";
import { ItemBulletType } from "@sk-widget/pages/details/activity-page/state/types";
import {
  type ActionYieldDto,
  dateGroupLabels,
} from "@sk-widget/pages/details/activity-page/types";
import { useMountAnimation } from "@sk-widget/providers/mount-animation";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { container, listItemWrapper } from "./style.css";

export const ActivityPageComponent = () => {
  const {
    content,
    allData,
    bulletLines,
    counts,
    labels,
    onActionSelect,
    activityActions,
  } = useActivityPage();

  const { t } = useTranslation();

  return (
    <Box className={container} display="flex" flex={1} flexDirection="column">
      {content}

      <Box display="flex" flexDirection="column">
        {!activityActions.isPending && allData && (
          <GroupedVirtualList
            hasNextPage={activityActions.hasNextPage}
            isFetchingNextPage={activityActions.isFetchingNextPage}
            fetchNextPage={activityActions.fetchNextPage}
            estimateSize={() => 100}
            groupCounts={counts}
            groupContent={(index) => {
              return (
                <Box paddingBottom="3">
                  <Text variant={{ weight: "bold" }}>
                    {dateGroupLabels(labels[index], t)}
                  </Text>
                </Box>
              );
            }}
            itemContent={(index) => {
              const item = allData[index];

              return (
                <Box
                  className={listItemWrapper}
                  paddingBottom={
                    bulletLines[index] === ItemBulletType.ALONE ||
                    bulletLines[index] === ItemBulletType.LAST
                      ? "4"
                      : "0"
                  }
                >
                  <ListItemBullet
                    isFirst={
                      bulletLines[index] === ItemBulletType.FIRST ||
                      bulletLines[index] === ItemBulletType.ALONE
                    }
                    isLast={
                      bulletLines[index] === ItemBulletType.LAST ||
                      bulletLines[index] === ItemBulletType.ALONE
                    }
                    status={item.actionData.status}
                  />
                  <ActionListItem
                    onActionSelect={onActionSelect}
                    action={item as ActionYieldDto}
                  />
                </Box>
              );
            }}
          />
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
