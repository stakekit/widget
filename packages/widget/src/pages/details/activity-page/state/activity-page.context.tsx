import { useConnectModal } from "@stakekit/rainbowkit";
import { Maybe } from "purify-ts";
import { createContext, type PropsWithChildren, useContext } from "react";
import { useNavigate } from "react-router";
import {
  ActionStatus,
  type TransactionType,
} from "../../../../domain/types/action";
import { useActivityActions } from "../../../../hooks/api/use-activity-actions";
import { useActivityContext } from "../../../../providers/activity-provider";
import { useSKWallet } from "../../../../providers/sk-wallet";
import type { ActionYieldDto } from "../types";
import type { ActivityPageContextType } from "./types";

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

      const urls = data.actionData.transactions
        .map((val) => ({ type: val.type, url: val.explorerUrl }))
        .filter(
          (val): val is { type: TransactionType; url: string } => !!val.url
        );

      const path =
        data.actionData.type === "UNSTAKE"
          ? "unstake"
          : data.actionData.type === "STAKE"
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
          selectedValidators: data.validatorsData,
        }),
      });

      return navigate("/activity/review");
    }

    return;
  };

  const activityActions = useActivityActions();

  const value = {
    onActionSelect,
    activityActions,
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
