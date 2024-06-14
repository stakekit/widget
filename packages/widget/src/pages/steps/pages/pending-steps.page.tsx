import { usePendingActionData } from "@sk-widget/hooks/use-pending-action-data";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { StepsPage } from "./common.page";

export const PendingStepsPage = () => {
  const { pendingRequest } = usePendingActionData();

  useTrackPage("pendingActionSteps");

  return <StepsPage session={pendingRequest.actionDto} />;
};
