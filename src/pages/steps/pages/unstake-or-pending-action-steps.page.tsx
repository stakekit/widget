import { StepsPage } from "./common.page";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";
import { usePendingActionData } from "@sk-widget/hooks/use-pending-action-data";
import { useStakeExitData } from "@sk-widget/hooks/use-stake-exit-data";

export const UnstakeOrPendingActionStepsPage = () => {
  const pendingActionData = usePendingActionData();
  const stakeExitData = useStakeExitData();

  const pendingActionMatch = usePendingActionMatch();

  useTrackPage(pendingActionMatch ? "pendingActionSteps" : "unstakeSteps");

  return (
    <StepsPage
      session={
        pendingActionMatch
          ? pendingActionData.pendingActionSession
          : stakeExitData.stakeExitSession
      }
    />
  );
};
