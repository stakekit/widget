import { useStakeEnterData } from "@sk-widget/hooks/use-stake-enter-data";
import { Navigate, Outlet } from "react-router-dom";

export const StakeCheck = () => {
  const { stakeSession } = useStakeEnterData();

  const isDetailsComplete = stakeSession.isJust();

  return isDetailsComplete ? <Outlet /> : <Navigate to="/" replace />;
};
