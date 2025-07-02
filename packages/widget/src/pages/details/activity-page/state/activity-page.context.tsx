import {
  ActionStatus,
  ActionTypes,
  type TransactionType,
} from "@stakekit/api-hooks";
import { useConnectModal } from "@stakekit/rainbowkit";
import { Maybe } from "purify-ts";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useActivityActions } from "../../../../hooks/api/use-activity-actions";
import { useActivityContext } from "../../../../providers/activity-provider";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { createSubArray, groupDateStrings } from "../../../../utils";
import type { ActionYieldDto } from "../types";
import type { ActivityPageContextType, ItemBulletType } from "./types";

export const ActivityPageContext = createContext<
  ActivityPageContextType | undefined
>(undefined);

export const ActivityPageContextProvider = ({
  children,
}: PropsWithChildren) => {
  const activityStore = useActivityContext();
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useSKWallet();
  const navigate = useNavigate();
  const { i18n } = useTranslation();

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

      const urls = data.actionData.transactions
        .map((val) => ({ type: val.type, url: val.explorerUrl }))
        .filter(
          (val): val is { type: TransactionType; url: string } => !!val.url
        );

      const path =
        data.actionData.type === ActionTypes.UNSTAKE
          ? "unstake"
          : data.actionData.type === ActionTypes.STAKE
            ? "stake"
            : "pending";

      // activity/:pendingActionType-review/complete and activity/:pendingActionType/complete
      // let us know if we came to complete page from steps page or actions list page
      return navigate(`/activity/${path}-review/complete`, {
        state: { urls },
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

      return navigate("/activity/review");
    }

    return;
  };

  const activityActions = useActivityActions();

  const actions = useMemo(
    () => Maybe.fromNullable(activityActions.allItems),
    [activityActions.allItems]
  );

  const groupedDates = useMemo(
    () => actions.map((action) => action.map((a) => a.actionData.createdAt)),
    [actions]
  );

  const [labels, counts] = useMemo(
    () => groupDateStrings(groupedDates.extract() ?? [], i18n),
    [groupedDates, i18n]
  );

  const bulletLines = useMemo(
    () =>
      counts.reduce<ItemBulletType[]>(
        (acc, val) => acc.concat(createSubArray(val)),
        []
      ),
    [counts]
  );

  const value = {
    onActionSelect,
    activityActions,
    labels,
    counts,
    bulletLines,
  };

  return (
    <ActivityPageContext.Provider value={value}>
      {children}
    </ActivityPageContext.Provider>
  );
};

export const useActivityPageContext = () => {
  const context = useContext(ActivityPageContext);

  if (!context) {
    throw new Error(
      "useActivityPageContext must be used within a ActivityPageContext"
    );
  }

  return context;
};
