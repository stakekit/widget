import { useTrackPage } from "../../../../tracking/state";
import { StepsPage } from "./common.page";

export const ActivityStepsPage = () => {
  useTrackPage("activitySteps");
  return <StepsPage />;
};
