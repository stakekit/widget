import { useTrackPage } from "../../../../tracking/state";
import { StepsPage } from "./common.page.tsx";

export const UnstakeStepsPage = () => {
  useTrackPage("unstakeSteps");

  return <StepsPage />;
};
