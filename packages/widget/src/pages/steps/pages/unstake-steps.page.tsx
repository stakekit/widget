import { useExitStakeRequestDto } from "@sk-widget/providers/exit-stake-request-dto";
import { Maybe } from "purify-ts";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { StepsPage } from "./common.page";

export const UnstakeStepsPage = () => {
  const unstakeActionData = useExitStakeRequestDto();

  useTrackPage("unstakeSteps");

  return <StepsPage session={Maybe.fromNullable(unstakeActionData?.val)} />;
};
