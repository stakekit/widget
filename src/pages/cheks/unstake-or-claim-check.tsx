import { Navigate, Outlet, useMatch } from "react-router-dom";
import { useUnstakeOrClaimState } from "../../state/unstake-or-claim";

export const UnstakeOrClaimCheck = () => {
  const { unstake, pendingActionSession } = useUnstakeOrClaimState();

  const claimMatch = useMatch("claim/:integrationId/:defaultOrValidatorId/*");
  const unstakeMatch = useMatch(
    "unstake/:integrationId/:defaultOrValidatorId/*"
  );

  const isReady = claimMatch
    ? pendingActionSession.isJust()
    : unstakeMatch
    ? unstake
        .chain((u) => u.amount)
        .mapOrDefault((val) => !val.isNaN() && !val.isZero(), false)
    : false;

  return isReady ? <Outlet /> : <Navigate to="/" replace />;
};
