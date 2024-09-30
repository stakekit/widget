import { useActivityActions } from "@sk-widget/hooks/api/use-activity-actions";
import {
  type ActivityPageContextType,
  ItemBulletType,
} from "@sk-widget/pages/details/activity-page/state/types";
import type { ActionYieldDto } from "@sk-widget/pages/details/activity-page/types";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { groupDateStrings } from "@sk-widget/utils/formatters";
import {
  ActionStatus,
  ActionTypes,
  type TransactionType,
} from "@stakekit/api-hooks";
import { useConnectModal } from "@stakekit/rainbowkit";
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
  const { isConnected } = useSKWallet();
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  const onActionSelect = (data: ActionYieldDto) => {
    if (!isConnected) return openConnectModal?.();

    activityStore.send({
      type: "setSelectedAction",
      data: Maybe.of({
        selectedAction: data.actionData,
        selectedYield: data.yieldData,
      }),
    });

    if (
      data.actionData.status === ActionStatus.SUCCESS ||
      data.actionData.status === ActionStatus.PROCESSING
    ) {
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
        state: {
          urls,
        },
      });
    }

    if (
      data.actionData.status === ActionStatus.CREATED ||
      data.actionData.status === ActionStatus.WAITING_FOR_NEXT ||
      data.actionData.status === ActionStatus.FAILED
    ) {
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

  const [labels, counts] = groupDateStrings(groupedDates.extract() ?? [], i18n);

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

const createSubArray = (val: number): ItemBulletType[] => {
  return Array.from({ length: val }, (_, i) => {
    if (val === 1) return ItemBulletType.ALONE;
    if (i === 0) return ItemBulletType.FIRST;
    if (i === val - 1) return ItemBulletType.LAST;
    return ItemBulletType.MIDDLE;
  });
};
