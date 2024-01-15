import { Navigate, Outlet } from "react-router-dom";
import { useUnstakeOrPendingActionState } from "../../state/unstake-or-pending-action";
import { usePendingActionMatch } from "../../hooks/navigation/use-pending-action-match";
import { useUnstakeMatch } from "../../hooks/navigation/use-unstake-match";

export const UnstakeOrPendingActionCheck = () => {
  const { unstakeSession, pendingActionSession } =
    useUnstakeOrPendingActionState();

  const pendingActionMatch = usePendingActionMatch();
  const unstakeMatch = useUnstakeMatch();

  const isReady = pendingActionMatch
    ? pendingActionSession.isJust()
    : unstakeMatch
      ? unstakeSession.isJust()
      : false;

  return isReady ? <Outlet /> : <Navigate to="/" replace />;
};
