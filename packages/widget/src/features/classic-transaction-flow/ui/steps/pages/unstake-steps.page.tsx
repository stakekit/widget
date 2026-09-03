import { useTrackPage } from "../../../../tracking/index";
import { StepsPage } from "./common.page.tsx";

export const UnstakeStepsPage = () => {
  useTrackPage("unstakeSteps");

  return <StepsPage />;
};
