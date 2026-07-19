import BigNumber from "bignumber.js";
import { getActionProviderYieldId } from "../../../../../domain/types/action";
import { defaultFormattedNumber } from "../../../../../shared/lib/number-format";
import { useProvidersDetails } from "../../../../earn/react/use-provider-details";
import { useYieldType } from "../../../../earn/react/use-yield-type";
import { useTrackPage } from "../../../../tracking/react/use-track-page";
import { useRequiredEnterStakeRequest } from "../../../react/request-route-guards";
import { CompletePage } from "./common.page";

export const StakeCompletePage = () => {
  useTrackPage("stakeComplete");

  const enterRequest = useRequiredEnterStakeRequest();
  const selectedStake = enterRequest.selectedStake;
  const selectedToken = enterRequest.selectedToken;
  const providerDetails = useProvidersDetails({
    integrationData: selectedStake,
    validators: enterRequest.selectedValidators,
    selectedProviderYieldId: getActionProviderYieldId(enterRequest.requestDto),
  });

  return (
    <CompletePage
      amount={defaultFormattedNumber(
        new BigNumber(enterRequest.requestDto.arguments?.amount ?? 0)
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
