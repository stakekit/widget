import { Box } from "@sk-widget/components/atoms/box";
import { Text } from "@sk-widget/components/atoms/typography/text";
import { GroupedVirtualList } from "@sk-widget/components/atoms/virtual-list";
import { ActionListItem } from "@sk-widget/pages-dashboard/activity/action-list-item";
import {
  container,
  listItemWrapper,
} from "@sk-widget/pages-dashboard/activity/styles.css";
import ListItemBullet from "@sk-widget/pages/details/activity-page/components/list-item-bullet";
import { useActivityPage } from "@sk-widget/pages/details/activity-page/hooks/use-activity-page";
import {
  ActivityPageContext,
  ActivityPageContextProvider,
  useActivityPageContext,
} from "@sk-widget/pages/details/activity-page/state/activity-page.context";
import { ItemBulletType } from "@sk-widget/pages/details/activity-page/state/types";
import {
  type ActionYieldDto,
  dateGroupLabels,
} from "@sk-widget/pages/details/activity-page/types";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { ActionStatus } from "@stakekit/api-hooks";
import { useConnectModal } from "@stakekit/rainbowkit";
import { Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";

const ActivityPageComponent = () => {
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
                    action={item}
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

const _ActivityPage = () => {
  const value = useActivityPageContext();

  const activityStore = useActivityContext();
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useSKWallet();

  const onActionSelect = (data: ActionYieldDto) => {
    if (!isConnected) return openConnectModal?.();

    if (
      data.actionData.status === ActionStatus.SUCCESS ||
      data.actionData.status === ActionStatus.PROCESSING
    ) {
      activityStore.send({
        type: "setSelectedAction",
        data: Maybe.of({
          selectedAction: data.actionData,
          selectedYield: data.yieldData,
        }),
      });
    }

    if (
      data.actionData.status === ActionStatus.CREATED ||
      data.actionData.status === ActionStatus.WAITING_FOR_NEXT ||
      data.actionData.status === ActionStatus.FAILED
    ) {
      activityStore.send({
        type: "setSelectedAction",
        data: Maybe.of({
          selectedAction: data.actionData,
          selectedYield: data.yieldData,
        }),
      });
    }

    return;
  };

  return (
    <ActivityPageContext.Provider value={{ ...value, onActionSelect }}>
      <ActivityPageComponent />
    </ActivityPageContext.Provider>
  );
};

export const ActivityPage = () => {
  return (
    <ActivityPageContextProvider>
      <_ActivityPage />
    </ActivityPageContextProvider>
  );
};
