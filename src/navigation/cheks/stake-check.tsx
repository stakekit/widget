import { Navigate, Outlet } from "react-router-dom";
import { useStakeEnterData } from "@sk-widget/hooks/use-stake-enter-data";

export const StakeCheck = () => {
  const { stakeSession } = useStakeEnterData();

  const isDetailsComplete = stakeSession.isJust();

  return isDetailsComplete ? <Outlet /> : <Navigate to="/" replace />;
};
