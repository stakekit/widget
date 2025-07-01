import { ActionStatus } from "@stakekit/api-hooks";
import { useConnectModal } from "@stakekit/rainbowkit";
import { useSelector } from "@xstate/store/react";
import { List, Maybe } from "purify-ts";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../components/atoms/box";
import { Text } from "../../components/atoms/typography/text";
import { GroupedVirtualList } from "../../components/atoms/virtual-list";
import ListItemBullet from "../../pages/details/activity-page/components/list-item-bullet";
import { useActivityPage } from "../../pages/details/activity-page/hooks/use-activity-page";
import {
  ActivityPageContext,
  ActivityPageContextProvider,
  useActivityPageContext,
} from "../../pages/details/activity-page/state/activity-page.context";
import { ItemBulletType } from "../../pages/details/activity-page/state/types";
import {
  type ActionYieldDto,
  dateGroupLabels,
} from "../../pages/details/activity-page/types";
import { useActivityContext } from "../../providers/activity-provider";
import { useSKWallet } from "../../providers/sk-wallet";
import { ActionListItem } from "./action-list-item";
import { container, listItemWrapper } from "./styles.css";

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
  const { isConnected, network } = useSKWallet();

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

  const selectedAction = useSelector(
    activityStore,
    (state) => state.context.selectedAction
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    activityStore.send({
      type: "setSelectedAction",
      data: Maybe.empty(),
    });
  }, [network, activityStore]);

  useEffect(() => {
    if (!isConnected && selectedAction.isJust()) {
      activityStore.send({
        type: "setSelectedAction",
        data: Maybe.empty(),
      });
    }
  }, [isConnected, selectedAction, activityStore]);

  /**
   * If the selected action is not set, set the first action in the list as the selected action
   */
  useEffect(() => {
    if (selectedAction.isJust() || !value.activityActions.allItems) return;

    List.head(value.activityActions.allItems).ifJust((val) =>
      activityStore.send({
        type: "setSelectedAction",
        data: Maybe.of({
          selectedAction: val.actionData,
          selectedYield: val.yieldData,
        }),
      })
    );
  }, [selectedAction, activityStore, value.activityActions.allItems]);

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
