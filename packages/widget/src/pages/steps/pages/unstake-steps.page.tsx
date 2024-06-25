import { useExitStakeState } from "@sk-widget/providers/exit-stake-state";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { StepsPage } from "./common.page";

export const UnstakeStepsPage = () => {
  const exitRequest = useExitStakeState().unsafeCoerce();

  useTrackPage("unstakeSteps");

  return <StepsPage session={exitRequest.actionDto} />;
};
