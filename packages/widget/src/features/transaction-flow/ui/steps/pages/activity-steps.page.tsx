import { useWidgetConfig } from "../../../../../app/config/use-widget-config";
import { useTrackPage } from "../../../../tracking/react/use-track-page";
import { StepsPage } from "./common.page";

export const ActivityStepsPage = () => {
  useTrackPage("activitySteps");
  const dashboardVariant = useWidgetConfig("dashboardVariant");

  return <StepsPage reviewTo={dashboardVariant ? "../.." : "../../review"} />;
};
