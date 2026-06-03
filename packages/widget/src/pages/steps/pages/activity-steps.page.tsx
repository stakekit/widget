import { useSelector } from "@xstate/store/react";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getActionInputToken } from "../../../domain/types/action";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useActivityContext } from "../../../providers/activity-provider";
import { StepsPage } from "./common.page";

export const ActivityStepsPage = () => {
  useTrackPage("activitySteps");

  const activityContext = useActivityContext();

  const selectedAction = useSelector(
    activityContext,
    (state) => state.context.selectedAction
  ).unsafeCoerce();

  const selectedYield = useSelector(
    activityContext,
    (state) => state.context.selectedYield
  ).unsafeCoerce();

  const selectedValidators = useSelector(
    activityContext,
    (state) => state.context.selectedValidators
  ).unsafeCoerce();

  const providersDetails = useProvidersDetails({
    integrationData: useMemo(() => Maybe.of(selectedYield), [selectedYield]),
    validators: useMemo(
      () => Maybe.of(selectedValidators),
      [selectedValidators]
    ),
    selectedProviderYieldId: Maybe.empty(),
  });

  return (
    <StepsPage
      inputToken={getActionInputToken({
        actionDto: selectedAction,
        yieldDto: selectedYield,
      })}
      session={selectedAction}
      providersDetails={providersDetails}
    />
  );
};
