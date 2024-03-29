import { useUnstakeOrPendingActionState } from "../../../state/unstake-or-pending-action";
import { StepsPage } from "./common.page";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useSetActionHistoryData } from "../../../providers/stake-history";
import { usePendingActionMatch } from "../../../hooks/navigation/use-pending-action-match";

export const UnstakeOrPendingActionStepsPage = () => {
  const { unstakeSession, pendingActionSession } =
    useUnstakeOrPendingActionState();

  const pendingActionMatch = usePendingActionMatch();

  useTrackPage(pendingActionMatch ? "pendingActionSteps" : "unstakeSteps");

  const setActionHistoryData = useSetActionHistoryData();

  const onDone = () =>
    setActionHistoryData({
      type: pendingActionMatch ? "pending_action" : "unstake",
    });

  return (
    <StepsPage
      session={pendingActionMatch ? pendingActionSession : unstakeSession}
      onDone={onDone}
    />
  );
};
