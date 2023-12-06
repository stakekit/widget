import { useMatch } from "react-router-dom";
import { useUnstakeOrPendingActionState } from "../../../state/unstake-or-pending-action";
import { StepsPage } from "./common.page";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useSetActionHistoryData } from "../../../providers/stake-history";

export const UnstakeOrPendingActionStepsPage = () => {
  const { unstakeSession, pendingActionSession } =
    useUnstakeOrPendingActionState();

  const isPendingAction = useMatch(
    "pending-action/:integrationId/:defaultOrValidatorId/steps"
  );

  useTrackPage(isPendingAction ? "pendingActionSteps" : "unstakeSteps");

  const setActionHistoryData = useSetActionHistoryData();

  const onDone = () =>
    setActionHistoryData({
      type: isPendingAction ? "pending_action" : "unstake",
    });

  return (
    <StepsPage
      session={isPendingAction ? pendingActionSession : unstakeSession}
      onDone={onDone}
    />
  );
};
