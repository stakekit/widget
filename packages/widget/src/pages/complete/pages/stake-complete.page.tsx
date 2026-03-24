import { useSelector } from "@xstate/store/react";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { getYieldMetadata } from "../../../domain/types/yields";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import { useEnterStakeStore } from "../../../providers/enter-stake-store";
import { formatNumber } from "../../../utils";
import { CompletePage } from "./common.page";

export const StakeCompletePage = () => {
  useTrackPage("stakeComplete");

  const enterRequest = useSelector(
    useEnterStakeStore(),
    (state) => state.context.data,
  ).unsafeCoerce();

  const selectedStake = useMemo(
    () => Maybe.of(enterRequest.selectedStake),
    [enterRequest.selectedStake],
  );

  const selectedToken = useMemo(
    () => Maybe.of(enterRequest.selectedToken),
    [enterRequest.selectedToken],
  );

  const metadata = selectedStake.map(getYieldMetadata);

  const network = selectedToken.mapOrDefault((y) => y.symbol, "");

  const amount = useMemo(
    () =>
      formatNumber(
        new BigNumber(enterRequest.requestDto.arguments?.amount ?? 0),
      ),
    [enterRequest.requestDto.arguments?.amount],
  );

  const yieldType = useYieldType(selectedStake).map((v) => v.type);

  const selectedProviderYieldId = useMemo(
    () => Maybe.fromNullable(enterRequest.requestDto.arguments?.providerId),
    [enterRequest.requestDto.arguments?.providerId],
  );

  const providerDetails = useProvidersDetails({
    integrationData: selectedStake,
    validatorsAddresses: Maybe.of(enterRequest.selectedValidators),
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
