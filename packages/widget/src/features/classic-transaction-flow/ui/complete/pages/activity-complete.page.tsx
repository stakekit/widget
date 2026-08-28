import { useTrackPage } from "../../../../tracking/index";
import {
  useActivityComplete,
  useActivityCompleteView,
} from "../hooks/use-activity-complete.hook";
import { CompletePage } from "./common.page.tsx";

const continuationCompletePageByIntent = {
  enter: "stakeComplete",
  exit: "unstakeComplete",
  manage: "pendingActionCompelete",
} as const;

const useContinuationCompleteTracking = (
  intent: "enter" | "exit" | "manage"
) => {
  useTrackPage(continuationCompletePageByIntent[intent]);
};

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
  useContinuationCompleteTracking(selectedAction.intent);

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
