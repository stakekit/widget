import { usePendingActionData } from "@sk-widget/hooks/use-pending-action-data";
import { Maybe } from "purify-ts";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { StepsPage } from "./common.page";

export const PendingStepsPage = () => {
  const { pendingRequestDto } = usePendingActionData();

  useTrackPage("pendingActionSteps");

  return (
    <StepsPage session={Maybe.fromNullable(pendingRequestDto.actionDto)} />
  );
};
