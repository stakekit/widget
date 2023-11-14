import { Navigate, Outlet, useMatch } from "react-router-dom";
import { useUnstakeOrPendingActionState } from "../../state/unstake-or-pending-action";

export const UnstakeOrPendingActionCheck = () => {
  const { unstake, pendingActionSession } = useUnstakeOrPendingActionState();

  const pendingActionMatch = useMatch(
    "pending-action/:integrationId/:defaultOrValidatorId/*"
  );
  const unstakeMatch = useMatch(
    "unstake/:integrationId/:defaultOrValidatorId/*"
  );

  const isReady = pendingActionMatch
    ? pendingActionSession.isJust()
    : unstakeMatch
      ? unstake
          .chain((u) => u.amount)
          .mapOrDefault((val) => !val.isNaN() && !val.isZero(), false)
      : false;

  return isReady ? <Outlet /> : <Navigate to="/" replace />;
};
