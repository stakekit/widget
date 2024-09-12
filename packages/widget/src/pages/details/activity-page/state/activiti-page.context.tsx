import { useActivityActions } from "@sk-widget/hooks/api/use-activity-actions";
import type { ActivityPageContextType } from "@sk-widget/pages/details/activity-page/state/types";
import type { ActionYieldDto } from "@sk-widget/pages/details/activity-page/types";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { groupDateStrings } from "@sk-widget/utils/formatters";
import type { ActionListNetwork, TransactionType } from "@stakekit/api-hooks";
import { useConnectModal } from "@stakekit/rainbowkit";
import { useMutation } from "@tanstack/react-query";
import { Maybe } from "purify-ts";
import {
  type PropsWithChildren,
  createContext,
  useContext,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const ActivityPageContext = createContext<ActivityPageContextType | undefined>(
  undefined
);

export const ActivityPageContextProvider = ({
  children,
}: PropsWithChildren) => {
  const activityStore = useActivityContext();
  const { openConnectModal } = useConnectModal();
  const { isConnected, chain } = useSKWallet();
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const onClickHandler = useMutation({
    mutationFn: async (data: ActionYieldDto) => {
      if (!isConnected) return openConnectModal?.();

      activityStore.send({
        type: "setSelectedAction",
        selectedAction: Maybe.of(data.actionData),
        selectedYield: Maybe.of(data.yieldData),
      });

      if (
        data.actionData.status === "SUCCESS" ||
        data.actionData.status === "PROCESSING"
      ) {
        return navigate("/activity/complete", {
          state: {
            urls: data.actionData.transactions
              .map((val) => ({ type: val.type, url: val.explorerUrl }))
              .filter(
                (val): val is { type: TransactionType; url: string } =>
                  !!val.url
              ),
          },
        });
      }

      if (
        data.actionData.status === "CREATED" ||
        data.actionData.status === "WAITING_FOR_NEXT" ||
        data.actionData.status === "FAILED"
      ) {
        return navigate("/activity/review");
      }

      return;
    },
  });

  const onActionSelect = (action: ActionYieldDto) => {
    onClickHandler.mutate(action);
  };

  const activityActions = useActivityActions({
    network: chain?.name.toLowerCase() as ActionListNetwork,
    sort: "createdAtDesc",
  });

  const actions = useMemo(
    () => Maybe.fromNullable(activityActions.allItems),
    [activityActions.allItems]
  );

  const groupedDates = useMemo(
    () =>
      actions
        .map((action) => action.map((a) => a.actionData.createdAt))
        .map((g) => g),
    [actions]
  );

  const [labels, counts] = groupDateStrings(groupedDates.extract() ?? [], i18n);

  const value = {
    onActionSelect,
    activityActions,
    labels,
    counts,
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
