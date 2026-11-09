import { useTrackPage } from "../../../../tracking/index";
import { StepsPage } from "./common.page.tsx";

export const EnterStepsPage = () => {
  useTrackPage("stakingSteps");

  return <StepsPage />;
};
