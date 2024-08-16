import { useExitStakeStore } from "@sk-widget/providers/exit-stake-store";
import { useSelector } from "@xstate/store/react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { StepsPage } from "./common.page";

export const UnstakeStepsPage = () => {
  const exitRequest = useSelector(
    useExitStakeStore(),
    (state) => state.context.data
  ).unsafeCoerce();

  useTrackPage("unstakeSteps");

  return <StepsPage session={exitRequest.actionDto.unsafeCoerce()} />;
};
