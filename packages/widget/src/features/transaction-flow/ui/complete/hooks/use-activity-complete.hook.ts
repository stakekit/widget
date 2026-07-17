import { getActionInputToken } from "../../../../../domain/types/action";
import { defaultFormattedNumber } from "../../../../../shared/lib";
import { useRequiredActivitySelection } from "../../../../activity";
import { useProvidersDetails } from "../../../../earn";
import { useYieldType } from "../../../../earn/support";
import { useTrackPage } from "../../../../tracking";

export const useActivityComplete = () => {
  useTrackPage("activityComplete");

  const { selectedAction, selectedValidators, selectedYield } =
    useRequiredActivitySelection();
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
