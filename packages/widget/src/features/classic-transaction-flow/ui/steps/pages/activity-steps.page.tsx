import { useTrackPage } from "../../../../tracking/state";
import { StepsPage } from "./common.page.tsx";

export const ActivityStepsPage = () => {
  useTrackPage("activitySteps");
  return <StepsPage />;
};
