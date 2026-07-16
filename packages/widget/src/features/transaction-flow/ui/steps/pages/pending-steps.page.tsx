import { useTrackPage } from "../../../../tracking";
import { StepsPage } from "./common.page";

export const PendingStepsPage = () => {
  useTrackPage("pendingActionSteps");

  return <StepsPage />;
};
