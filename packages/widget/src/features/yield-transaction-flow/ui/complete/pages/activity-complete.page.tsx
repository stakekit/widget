import { useAtomValue } from "@effect/atom-react";

import { useTrackPage } from "../../../../tracking/index";
import type { YieldFlowExecutionVariant } from "../../../state/execution-page";
import { useActivityCompleteView } from "../hooks/use-activity-complete.hook";
import { useExitSummary } from "../hooks/use-exit-summary.hook";
import { CompletePage } from "./common.page.tsx";

const continuationCompletePageByIntent = {
  enter: "stakeComplete",
  exit: "unstakeComplete",
  manage: "pendingActionCompelete",
} as const;

/** Complete for an action continued from Activity. */
export const ActivityCompletePage = ({
  execution,
}: {
  readonly execution: YieldFlowExecutionVariant<"YieldActionContinuation">;
}) => {
  const view = useAtomValue(execution.activityCompleteViewAtom);
  const { amount, yieldType, network, selectedAction } =
    useActivityCompleteView(view);
  useTrackPage(continuationCompletePageByIntent[selectedAction.intent]);
  // Only an exit unlocks later or pays out in another token.
  const { note, rows } = useExitSummary({
    amount,
    batched: view.batchSide === "redemption",
    receiveSymbol: view.receiveToken?.symbol ?? null,
    symbol: network,
    unlockDateAtom: execution.exitUnlockDateAtom,
  });
  // An exit's payout token, else the token the action moved: what an entry
  // deposited, or what an exit or a pending action moved.
  const markToken = view.receiveToken ?? view.inputToken;

  return (
    <CompletePage
      execution={execution}
      yieldType={yieldType}
      markToken={markToken}
      network={network}
      amount={amount}
      pendingActionType={selectedAction.type}
      batched={
        view.batchSide
          ? { side: view.batchSide, yieldDto: view.selectedYield }
          : null
      }
      integrationId={selectedAction.yieldId}
      note={note}
      rows={rows}
    />
  );
};
