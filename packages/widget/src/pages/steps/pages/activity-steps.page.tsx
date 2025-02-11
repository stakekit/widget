import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { useSelector } from "@xstate/store/react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { StepsPage } from "./common.page";

export const ActivityStepsPage = () => {
  useTrackPage("activitySteps");

  const selectedAction = useSelector(
    useActivityContext(),
    (state) => state.context.selectedAction
  ).unsafeCoerce();

  return <StepsPage session={selectedAction} />;
};
