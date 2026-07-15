import { getActionInputToken } from "../../../../../domain/types/action";
import {
  useActivitySelectedAction,
  useActivitySelectedValidators,
  useActivitySelectedYield,
} from "../../../../activity";
import { useProvidersDetails } from "../../../../earn";
import { useTrackPage } from "../../../../tracking";
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
