import { useTrackPage } from "../../../../tracking/state";
import { StepsPage } from "./common.page";

export const StakeStepsPage = () => {
  useTrackPage("stakingSteps");

  return <StepsPage />;
};
