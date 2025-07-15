import {
  ActionStatus,
  ActionTypes,
  type TransactionType,
} from "@stakekit/api-hooks";
import { useSelector } from "@xstate/store/react";
import { Box } from "../../components/atoms/box";
import { useActivityComplete } from "../../pages/complete/hooks/use-activity-complete.hook";
import { useComplete } from "../../pages/complete/hooks/use-complete.hook";
import { CompletePageComponent } from "../../pages/complete/pages/common.page";
import { CompleteCommonContextProvider } from "../../pages/complete/state";
import { ActionReviewPage } from "../../pages/review/pages/action-review.page";
import { useActivityContext } from "../../providers/activity-provider";

export const ActivityDetailsPage = () => {
  const activityContext = useActivityContext();

  const selectedAction = useSelector(
    activityContext,
    (state) => state.context.selectedAction
  ).extractNullable();

  const selectedYield = useSelector(
    activityContext,
    (state) => state.context.selectedYield
  ).extractNullable();

  if (!selectedYield || !selectedAction) {
    return null;
  }

  if (
    selectedAction.status === ActionStatus.SUCCESS ||
    selectedAction.status === ActionStatus.PROCESSING
  ) {
    return (
      <Box flex={1} px="4">
        <ActivityCompletePage key={selectedAction.id} />
      </Box>
    );
  }

  if (
    selectedAction.status === ActionStatus.CREATED ||
    selectedAction.status === ActionStatus.WAITING_FOR_NEXT ||
    selectedAction.status === ActionStatus.FAILED
  ) {
    return (
      <Box flex={1} px="4">
        <ActionReviewPage key={selectedAction.id} />
      </Box>
    );
  }

  return null;
};

const ActivityCompletePage = () => {
  const {
    amount,
    yieldType,
    inputToken,
    metadata,
    network,
    providerDetails,
    selectedAction,
  } = useActivityComplete();

  const { onViewTransactionClick } = useComplete();

  const urls = selectedAction.transactions
    .map((val) => ({ type: val.type, url: val.explorerUrl }))
    .filter((val): val is { type: TransactionType; url: string } => !!val.url);

  return (
    <CompleteCommonContextProvider
      value={{
        urls,
        onViewTransactionClick,
        unstakeMatch: selectedAction.type === ActionTypes.UNSTAKE,
        pendingActionMatch:
          selectedAction.type !== ActionTypes.STAKE &&
          selectedAction.type !== ActionTypes.UNSTAKE,
      }}
    >
      <CompletePageComponent
        yieldType={yieldType}
        providersDetails={providerDetails}
        token={inputToken}
        metadata={metadata}
        network={network}
        amount={amount}
        pendingActionType={selectedAction.type}
        integrationId={selectedAction.integrationId}
      />
    </CompleteCommonContextProvider>
  );
};
