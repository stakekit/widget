import { usePendingActionState } from "@sk-widget/providers/pending-action-state";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { StepsPage } from "./common.page";

export const PendingStepsPage = () => {
  const pendingRequest = usePendingActionState().unsafeCoerce();

  useTrackPage("pendingActionSteps");

  return <StepsPage session={pendingRequest.actionDto.unsafeCoerce()} />;
};
