import { useActivityActions } from "@sk-widget/hooks/api/use-activity-actions";
import type { ActivityPageContextType } from "@sk-widget/pages/details/activity-page/state/types";
import type { ActionYieldDto } from "@sk-widget/pages/details/activity-page/types";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { useConnectModal } from "@stakekit/rainbowkit";
import { useMutation } from "@tanstack/react-query";
import { Maybe } from "purify-ts";
import { type PropsWithChildren, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";

const ActivityPageContext = createContext<ActivityPageContextType | undefined>(
  undefined
);

export const ActivityPageContextProvider = ({
  children,
}: PropsWithChildren) => {
  const activityStore = useActivityContext();
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useSKWallet();
  const navigate = useNavigate();

  const onClickHandler = useMutation({
    mutationFn: async (data: ActionYieldDto) => {
      if (!isConnected) return openConnectModal?.();

      activityStore.send({
        type: "setSelectedAction",
        selectedAction: Maybe.of(data.actionData),
        selectedYield: Maybe.of(data.yieldData),
      });

      if (data.actionData.status === "SUCCESS")
        return navigate("/activity/complete");
      navigate("/activity/steps");
    },
  });

  const onActionSelect = (action: ActionYieldDto) => {
    onClickHandler.mutate(action);
  };

  const activityActions = useActivityActions({});

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
