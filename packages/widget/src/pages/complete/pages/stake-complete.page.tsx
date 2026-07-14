import BigNumber from "bignumber.js";
import { getActionProviderYieldId } from "../../../domain/types/action";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import { useEnterStakeRequest } from "../../../providers/enter-stake-store";
import { defaultFormattedNumber } from "../../../utils";
import { CompletePage } from "./common.page";

export const StakeCompletePage = () => {
  useTrackPage("stakeComplete");

  const enterRequest = useEnterStakeRequest()!;
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
