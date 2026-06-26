import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getActionInputToken } from "../../../domain/types/action";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import {
  useActivitySelectedAction,
  useActivitySelectedValidators,
  useActivitySelectedYield,
} from "../../../providers/activity-provider";
import { StepsPage } from "./common.page";

export const ActivityStepsPage = () => {
  useTrackPage("activitySteps");

  const selectedAction = useActivitySelectedAction().unsafeCoerce();
  const selectedYield = useActivitySelectedYield().unsafeCoerce();
  const selectedValidators = useActivitySelectedValidators().unsafeCoerce();

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
