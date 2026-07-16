import { useTrackPage } from "../../../../tracking";
import { StepsPage } from "./common.page";

export const ActivityStepsPage = () => {
  useTrackPage("activitySteps");

  return <StepsPage />;
};
