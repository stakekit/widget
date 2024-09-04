import { useActivityActions } from "@sk-widget/hooks/api/use-activity-actions";
import type { ActivityPageContextType } from "@sk-widget/pages/details/activity-page/state/types";
import type { ActionYieldDto } from "@sk-widget/pages/details/activity-page/types";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import type { ActionListNetwork } from "@stakekit/api-hooks";
import { useConnectModal } from "@stakekit/rainbowkit";
import { useMutation } from "@tanstack/react-query";
import { Maybe } from "purify-ts";
import {
  type PropsWithChildren,
  createContext,
  useContext,
  useMemo,
} from "react";
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
        return navigate("/activity/complete");
      }
      navigate("/activity/steps");
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

  const [labels, counts] = groupDateStrings(groupedDates.extract() ?? []);

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

const groupDateStrings = (dateStrings: string[]): [string[], number[]] => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const labelsMap: { [key: string]: string } = {};
  const countMap: { [key: string]: number } = {};

  dateStrings.forEach((dateString) => {
    const date = new Date(dateString);
    let label: string;

    if (date.toDateString() === today.toDateString()) {
      label = "today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = "yesterday";
    } else {
      label = formatDate(date);
    }

    if (countMap[label]) {
      countMap[label]++;
    } else {
      countMap[label] = 1;
      labelsMap[label] = label;
    }
  });

  const labels = Object.values(labelsMap);
  const counts = Object.values(countMap);

  return [labels, counts];
};
