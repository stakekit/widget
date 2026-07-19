import BigNumber from "bignumber.js";
import { getActionProviderYieldId } from "../../../../../domain/types/action";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useProvidersDetails } from "../../../../earn/react/use-provider-details";
import { useYieldType } from "../../../../earn/react/use-yield-type";
import { useTrackPage } from "../../../../tracking/react/use-track-page";
import { useRequiredEnterClassicTransactionFlow } from "../../../react/request-route-guards";
import { CompletePage } from "./common.page";

export const StakeCompletePage = () => {
  useTrackPage("stakeComplete");

  const enterFlow = useRequiredEnterClassicTransactionFlow();
  const selectedStake = enterFlow.selectedStake;
  const selectedToken = enterFlow.selectedToken;
  const providerDetails = useProvidersDetails({
    integrationData: selectedStake,
    validators: new Map(enterFlow.selectedValidators),
    selectedProviderYieldId: getActionProviderYieldId(enterFlow.request),
  });

  return (
    <CompletePage
      amount={defaultFormattedNumber(
        new BigNumber(enterFlow.request.arguments?.amount ?? 0)
      )}
      integrationId={selectedStake.id}
      metadata={{
        logoURI: selectedStake.metadata.logoURI,
        name: selectedStake.metadata.name,
        provider: selectedStake.provider,
      }}
      network={selectedToken.symbol}
      providersDetails={providerDetails}
      token={selectedToken}
      yieldType={useYieldType(selectedStake)?.type ?? null}
    />
  );
};
