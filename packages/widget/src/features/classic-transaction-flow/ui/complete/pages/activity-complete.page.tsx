import {
  useActivityComplete,
  useActivityCompleteView,
} from "../hooks/use-activity-complete.hook";
import { CompletePage } from "./common.page";

const ActivityCompleteContent = ({
  view,
}: {
  readonly view: NonNullable<ReturnType<typeof useActivityComplete>>;
}) => {
  const {
    amount,
    yieldType,
    inputToken,
    metadata,
    network,
    providerDetails,
    selectedAction,
  } = useActivityCompleteView(view);

  return (
    <CompletePage
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

export const ActivityCompletePage = () => {
  const view = useActivityComplete();
  return view ? <ActivityCompleteContent view={view} /> : null;
};
