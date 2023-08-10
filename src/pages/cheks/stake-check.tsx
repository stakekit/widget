import { Navigate, Outlet } from "react-router-dom";
import { useStakeState } from "../../state/stake";

export const StakeCheck = () => {
  const { selectedStake, stakeAmount } = useStakeState();

  const isDetailsComplete = selectedStake
    .chain(() => stakeAmount.map((a) => !a.isZero() && !a.isNaN()))
    .extractNullable();

  return isDetailsComplete ? <Outlet /> : <Navigate to="/" replace />;
};
