import { useTrackPage } from "../../../../tracking/index";
import { StepsPage } from "./common.page.tsx";

export const StakeStepsPage = () => {
  useTrackPage("stakingSteps");

  return <StepsPage />;
};
