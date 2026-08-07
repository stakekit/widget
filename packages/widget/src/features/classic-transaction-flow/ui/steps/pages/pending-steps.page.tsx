import { useTrackPage } from "../../../../tracking/state";
import { StepsPage } from "./common.page";

export const PendingStepsPage = () => {
  useTrackPage("pendingActionSteps");

  return <StepsPage />;
};
