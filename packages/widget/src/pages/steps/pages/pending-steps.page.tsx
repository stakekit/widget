import { usePendingActionStore } from "@sk-widget/providers/pending-action-store";
import { useSelector } from "@xstate/store/react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { StepsPage } from "./common.page";

export const PendingStepsPage = () => {
  const pendingRequest = useSelector(
    usePendingActionStore(),
    (state) => state.context.data
  ).unsafeCoerce();

  useTrackPage("pendingActionSteps");

  return <StepsPage session={pendingRequest.actionDto.unsafeCoerce()} />;
};
