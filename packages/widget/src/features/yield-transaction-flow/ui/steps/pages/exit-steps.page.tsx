import { useTrackPage } from "../../../../tracking/index";
import { StepsPage } from "./common.page.tsx";

export const ExitStepsPage = () => {
  useTrackPage("unstakeSteps");

  return <StepsPage />;
};
