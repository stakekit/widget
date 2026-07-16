import { useTrackPage } from "../../../../tracking";
import { StepsPage } from "./common.page";

export const StakeStepsPage = () => {
  useTrackPage("stakingSteps");

  return <StepsPage />;
};
