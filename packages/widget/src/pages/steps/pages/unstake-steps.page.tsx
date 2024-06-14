import { useStakeExitData } from "@sk-widget/hooks/use-stake-exit-data";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { StepsPage } from "./common.page";

export const UnstakeStepsPage = () => {
  const { exitRequest } = useStakeExitData();

  useTrackPage("unstakeSteps");

  return <StepsPage session={exitRequest.actionDto} />;
};
