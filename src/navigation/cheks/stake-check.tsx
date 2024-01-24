import { Navigate, Outlet } from "react-router-dom";
import { useStakeState } from "../../state/stake";

export const StakeCheck = () => {
  const { stakeSession } = useStakeState();

  const isDetailsComplete = stakeSession.isJust();

  return isDetailsComplete ? <Outlet /> : <Navigate to="/" replace />;
};
