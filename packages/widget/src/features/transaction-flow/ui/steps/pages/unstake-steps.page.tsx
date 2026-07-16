import { useTrackPage } from "../../../../tracking";
import { StepsPage } from "./common.page";

export const UnstakeStepsPage = () => {
  useTrackPage("unstakeSteps");

  return <StepsPage />;
};
