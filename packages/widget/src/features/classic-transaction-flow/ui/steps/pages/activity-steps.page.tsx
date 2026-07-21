import { useTrackPage } from "../../../../tracking/react/use-track-page";
import { StepsPage } from "./common.page";

export const ActivityStepsPage = () => {
  useTrackPage("activitySteps");
  return <StepsPage />;
};
