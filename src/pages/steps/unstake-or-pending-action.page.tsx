import { useMatch } from "react-router-dom";
import { useUnstakeOrPendingActionState } from "../../state/unstake-or-pending-action";
import { StepsPage } from "./common.page";

export const UnstakeOrPendingActionStepsPage = () => {
  const { unstakeSession, pendingActionSession } =
    useUnstakeOrPendingActionState();

  return (
    <StepsPage
      session={
        useMatch("pending-action/:integrationId/:defaultOrValidatorId/steps")
          ? pendingActionSession
          : unstakeSession
      }
    />
  );
};
