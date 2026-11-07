import { useTrackPage } from "../../../../tracking/index";
import {
  useActivityComplete,
  useActivityCompleteView,
} from "../hooks/use-activity-complete.hook";
import { useExitSummary } from "../hooks/use-exit-summary.hook";
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
  const { amount, yieldType, network, selectedAction } =
    useActivityCompleteView(view);
  useContinuationCompleteTracking(selectedAction.intent);
  // Only an exit unlocks later or pays out in another token.
  const { note, rows } = useExitSummary({
    amount,
    batched: view.batchSide === "redemption",
    receiveSymbol: view.receiveToken?.symbol ?? null,
    symbol: network,
  });
  // An exit's payout token, else the token the action moved: what an entry
  // deposited, or what an exit or a pending action moved.
  const markToken = view.receiveToken ?? view.inputToken;

  return (
    <CompletePage
      yieldType={yieldType}
      markToken={markToken}
      network={network}
      amount={amount}
      pendingActionType={selectedAction.type}
      batched={
        view.batchSide && view.selectedYield
          ? { side: view.batchSide, yieldDto: view.selectedYield }
          : null
      }
      integrationId={selectedAction.yieldId}
      note={note}
      rows={rows}
    />
  );
};

export const ActivityCompletePage = () => {
  const view = useActivityComplete();
  return view ? <ActivityCompleteContent view={view} /> : null;
};
