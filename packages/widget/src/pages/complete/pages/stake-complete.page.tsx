import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import { useEnterStakeRequest } from "../../../providers/enter-stake-store";
import { defaultFormattedNumber } from "../../../utils";
import { CompletePage } from "./common.page";

export const StakeCompletePage = () => {
  useTrackPage("stakeComplete");

  const enterRequest = useEnterStakeRequest().unsafeCoerce();

  const selectedStake = useMemo(
    () => Maybe.of(enterRequest.selectedStake),
    [enterRequest.selectedStake]
  );

  const selectedToken = useMemo(
    () => Maybe.of(enterRequest.selectedToken),
    [enterRequest.selectedToken]
  );

  const metadata = selectedStake.map((yieldDto) => ({
    logoURI: yieldDto.metadata.logoURI,
    name: yieldDto.metadata.name,
    provider: yieldDto.provider,
  }));

  const network = selectedToken.mapOrDefault((y) => y.symbol, "");

  const amount = useMemo(
    () =>
      defaultFormattedNumber(
        new BigNumber(enterRequest.requestDto.arguments?.amount ?? 0)
      ),
    [enterRequest.requestDto.arguments?.amount]
  );

  const yieldType = useYieldType(selectedStake).map((v) => v.type);

  const selectedProviderYieldId = useMemo(
    () => Maybe.fromNullable(enterRequest.requestDto.arguments?.providerId),
    [enterRequest.requestDto.arguments?.providerId]
  );

  const providerDetails = useProvidersDetails({
    integrationData: selectedStake,
    validators: Maybe.of(enterRequest.selectedValidators),
    selectedProviderYieldId,
  });

  return (
    <CompletePage
      yieldType={yieldType}
      providersDetails={providerDetails}
      token={selectedToken}
      metadata={metadata}
      network={network}
      amount={amount}
      integrationId={enterRequest.selectedStake.id}
    />
  );
};
