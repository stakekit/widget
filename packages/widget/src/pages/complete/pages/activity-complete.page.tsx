import { useActivityComplete } from "@sk-widget/pages/complete/hooks/use-activity-complete.hook";
import { CompletePage } from "@sk-widget/pages/complete/pages/common.page";

export const ActivityCompletePage = () => {
  const {
    amount,
    yieldType,
    inputToken,
    metadata,
    network,
    providerDetails,
    selectedAction,
  } = useActivityComplete();

  return (
    <CompletePage
      yieldType={yieldType}
      providersDetails={providerDetails}
      token={inputToken}
      metadata={metadata}
      network={network}
      amount={amount}
      pendingActionType={selectedAction.type}
    />
  );
};
