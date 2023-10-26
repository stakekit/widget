import { useMatch } from "react-router-dom";
import { useUnstakeOrPendingActionState } from "../../state/unstake-or-pending-action";
import { StepsPage } from "./common.page";
import { useTrackPage } from "../../hooks/tracking/use-track-page";

export const UnstakeOrPendingActionStepsPage = () => {
  const { unstakeSession, pendingActionSession } =
    useUnstakeOrPendingActionState();

  const isPendingAction = useMatch(
    "pending-action/:integrationId/:defaultOrValidatorId/steps"
  );

  useTrackPage(isPendingAction ? "pendingActionSteps" : "unstakeSteps");

  return (
    <StepsPage
      session={isPendingAction ? pendingActionSession : unstakeSession}
    />
  );
};
