import BigNumber from "bignumber.js";
import { getActionProviderYieldId } from "../../../../../domain/types/action";
import { defaultFormattedNumber } from "../../../../../shared/lib";
import { useProvidersDetails } from "../../../../earn";
import { useYieldType } from "../../../../earn/support";
import { useTrackPage } from "../../../../tracking";
import { useEnterStakeRequest } from "../../..";
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
