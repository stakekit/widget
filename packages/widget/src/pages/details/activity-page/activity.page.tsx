import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { Text } from "../../../components/atoms/typography/text";
import { GroupedVirtualList } from "../../../components/atoms/virtual-list";
import { useMountAnimation } from "../../../providers/mount-animation";
import { PageContainer } from "../../components/page-container";
import { ActionListItem } from "./components/action-list-item";
import ListItemBullet from "./components/list-item-bullet";
import { useActivityPage } from "./hooks/use-activity-page";
import { ActivityPageContextProvider } from "./state/activity-page.context";
import { ItemBulletType } from "./state/types";
import { container, listItemWrapper } from "./style.css";
import { type ActionYieldDto, dateGroupLabels } from "./types";

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
