import { useTrackPage } from "../../../../tracking/state";
import { StepsPage } from "./common.page.tsx";

export const PendingStepsPage = () => {
  useTrackPage("pendingActionSteps");

  return <StepsPage />;
};
