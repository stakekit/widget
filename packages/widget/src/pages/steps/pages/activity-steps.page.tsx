import { useProvidersDetails } from "@sk-widget/hooks/use-provider-details";
import { useActivityContext } from "@sk-widget/providers/activity-provider";
import { useSelector } from "@xstate/store/react";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
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

  const providersDetails = useProvidersDetails({
    integrationData: useMemo(() => Maybe.of(selectedYield), [selectedYield]),
    validatorsAddresses: useMemo(
      () => Maybe.of(selectedAction.validatorAddresses ?? []),
      [selectedAction.validatorAddresses]
    ),
    selectedProviderYieldId: Maybe.empty(),
  });

  return (
    <StepsPage session={selectedAction} providersDetails={providersDetails} />
  );
};
