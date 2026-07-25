import { useTrackPage } from "../../../../tracking/state";
import { StepsPage } from "./common.page";

export const UnstakeStepsPage = () => {
  useTrackPage("unstakeSteps");

  return <StepsPage />;
};
