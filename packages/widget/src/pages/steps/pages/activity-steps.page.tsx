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

  const selectedAction = useActivitySelectedAction()!;
  const selectedYield = useActivitySelectedYield()!;
  const selectedValidators = useActivitySelectedValidators()!;

  const providersDetails = useProvidersDetails({
    integrationData: selectedYield,
    validators: selectedValidators,
    selectedProviderYieldId: null,
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
