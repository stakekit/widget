import { useStakeState } from "../../state/stake";
import { StepsPage } from "./common.page";

export const StakeStepsPage = () => {
  const { stakeSession } = useStakeState();

  return <StepsPage session={stakeSession} />;
};
