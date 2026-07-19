import { useTrackPage } from "../../../../tracking/react/use-track-page";
import { StepsPage } from "./common.page";

export const StakeStepsPage = () => {
  useTrackPage("stakingSteps");

  return <StepsPage />;
};
