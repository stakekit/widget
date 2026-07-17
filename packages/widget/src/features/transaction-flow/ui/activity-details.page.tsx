import {
  ActionStatus,
  type TransactionType,
} from "../../../domain/types/action";
import { Box } from "../../../shared/ui/primitives/box";
import { useRequiredActivitySelection } from "../../activity";
import { useActivityComplete } from "./complete/hooks/use-activity-complete.hook";
import { useComplete } from "./complete/hooks/use-complete.hook";
import { CompletePageComponent } from "./complete/pages/common.page";
import { ActionReviewPage } from "./review/pages/action-review.page";

export const ActivityDetailsPage = () => {
  const { selectedAction } = useRequiredActivitySelection();

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
    <CompletePageComponent
      completion={{
        cta: null,
        urls,
        onViewTransactionClick,
        unstakeMatch: selectedAction.type === "UNSTAKE",
        pendingActionMatch:
          selectedAction.type !== "STAKE" && selectedAction.type !== "UNSTAKE",
      }}
      yieldType={yieldType}
      providersDetails={providerDetails}
      token={inputToken}
      metadata={metadata}
      network={network}
      amount={amount}
      pendingActionType={selectedAction.type}
      integrationId={selectedAction.yieldId}
    />
  );
};
