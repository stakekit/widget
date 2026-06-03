import { useConnectModal } from "@stakekit/rainbowkit";
import { useSelector } from "@xstate/store/react";
import { Maybe } from "purify-ts";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../components/atoms/box";
import { Text } from "../../components/atoms/typography/text";
import { VirtualList } from "../../components/atoms/virtual-list";
import { ActionStatus } from "../../domain/types/action";
import { ActionListItem } from "../../pages/details/activity-page/components/action-list-item";
import { useActivityPage } from "../../pages/details/activity-page/hooks/use-activity-page";
import {
  ActivityPageContext,
  ActivityPageContextProvider,
  useActivityPageContext,
} from "../../pages/details/activity-page/state/activity-page.context";
import type { ActionYieldDto } from "../../pages/details/activity-page/types";
import { useActivityContext } from "../../providers/activity-provider";
import { useSKWallet } from "../../providers/sk-wallet";
import { container } from "./styles.css";

const ActivityPageComponent = () => {
  const {
    content,
    allData,
    showingCount,
    total,
    onActionSelect,
    activityActions,
  } = useActivityPage();

  const { t } = useTranslation();

  return (
    <Box className={container} display="flex" flex={1} flexDirection="column">
      {content}

      <Box display="flex" flexDirection="column">
        {!activityActions.isPending && allData && !!allData.length && (
          <>
            <Box display="flex" justifyContent="flex-end" paddingBottom="2">
              <Text
                variant={{ type: "muted", weight: "normal", size: "small" }}
              >
                {t("activity.showing_count", { showing: showingCount, total })}
              </Text>
            </Box>

            <VirtualList
              data={allData}
              hasNextPage={activityActions.hasNextPage}
              isFetchingNextPage={activityActions.isFetchingNextPage}
              fetchNextPage={activityActions.fetchNextPage}
              estimateSize={() => 80}
              itemContent={(_index, item) => (
                <ActionListItem onActionSelect={onActionSelect} action={item} />
              )}
            />
          </>
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
          selectedValidators: data.validatorsData,
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
          selectedValidators: data.validatorsData,
        }),
      });
    }

    return;
  };

  const selectedAction = useSelector(
    activityStore,
    (state) => state.context.selectedAction
  );

  // biome-ignore lint: false
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
