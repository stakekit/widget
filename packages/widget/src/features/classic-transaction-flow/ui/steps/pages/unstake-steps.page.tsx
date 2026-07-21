import { useTrackPage } from "../../../../tracking/react/use-track-page";
import { StepsPage } from "./common.page";

export const UnstakeStepsPage = () => {
  useTrackPage("unstakeSteps");

  return <StepsPage />;
};
