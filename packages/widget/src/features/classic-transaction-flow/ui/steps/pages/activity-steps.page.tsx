import { useTrackPage } from "../../../../tracking/index";
import { StepsPage } from "./common.page.tsx";

export const ActivityStepsPage = () => {
  useTrackPage("activitySteps");
  return <StepsPage />;
};
