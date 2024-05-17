import { Navigate, Outlet } from "react-router-dom";
import { usePendingActionMatch } from "../../hooks/navigation/use-pending-action-match";
import { useUnstakeMatch } from "../../hooks/navigation/use-unstake-match";
import { useStakeExitData } from "@sk-widget/hooks/use-stake-exit-data";
import { usePendingActionData } from "@sk-widget/hooks/use-pending-action-data";

export const UnstakeOrPendingActionCheck = () => {
  const stakeExitData = useStakeExitData();
  const pendingActionData = usePendingActionData();

  const pendingActionMatch = usePendingActionMatch();
  const unstakeMatch = useUnstakeMatch();

  const isReady = pendingActionMatch
    ? pendingActionData.pendingActionSession.isJust()
    : unstakeMatch
      ? stakeExitData.stakeExitSession.isJust()
      : false;

  return isReady ? <Outlet /> : <Navigate to="/" replace />;
};
