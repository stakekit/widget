import { getActionInputToken } from "../../../domain/types/action";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import {
  useActivitySelectedAction,
  useActivitySelectedValidators,
  useActivitySelectedYield,
} from "../../../providers/activity-provider";
import { defaultFormattedNumber } from "../../../utils";

export const useActivityComplete = () => {
  useTrackPage("activityComplete");

  const selectedAction = useActivitySelectedAction()!;
  const selectedYield = useActivitySelectedYield();
  const selectedValidators = useActivitySelectedValidators();
  const inputToken = getActionInputToken({
    actionDto: selectedAction,
    yieldDto: selectedYield ?? undefined,
  });
  const providerDetails = useProvidersDetails({
    integrationData: selectedYield,
    validators: selectedValidators,
    selectedProviderYieldId: selectedAction.yieldId,
  });

  return {
    amount: defaultFormattedNumber(selectedAction.amount ?? 0),
    inputToken: inputToken ?? null,
    metadata: selectedYield
      ? {
          logoURI: selectedYield.metadata.logoURI,
          name: selectedYield.metadata.name,
          provider: selectedYield.provider,
        }
      : null,
    network: inputToken?.symbol ?? "",
    providerDetails,
    selectedAction,
    yieldType: useYieldType(selectedYield)?.type ?? null,
  };
};
