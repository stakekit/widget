import { getActionInputToken } from "../../../../../domain/types/action";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useProvidersDetails } from "../../../../earn/react/use-provider-details";
import { useYieldType } from "../../../../earn/react/use-yield-type";
import { useTrackPage } from "../../../../tracking/react/use-track-page";
import { useRequiredActivityResumeClassicTransactionFlow } from "../../../react/request-route-guards";

export const useActivityComplete = () => {
  useTrackPage("activityComplete");

  const {
    action: selectedAction,
    selectedValidators,
    selectedYield,
  } = useRequiredActivityResumeClassicTransactionFlow();
  const inputToken = getActionInputToken({
    actionDto: selectedAction,
    yieldDto: selectedYield,
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
