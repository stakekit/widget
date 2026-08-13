import { useTrackPage } from "../../../../tracking/state";
import { StepsPage } from "./common.page.tsx";

export const StakeStepsPage = () => {
  useTrackPage("stakingSteps");

  return <StepsPage />;
};
