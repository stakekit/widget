import { useTrackPage } from "../../../../tracking/index";
import { StepsPage } from "./common.page.tsx";

export const PendingStepsPage = () => {
  useTrackPage("pendingActionSteps");

  return <StepsPage />;
};
