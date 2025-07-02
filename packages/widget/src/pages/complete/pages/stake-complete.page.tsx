import { useSelector } from "@xstate/store/react";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
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
    (state) => state.context.data
  ).unsafeCoerce();

  const selectedStake = useMemo(
    () => Maybe.of(enterRequest.selectedStake),
    [enterRequest.selectedStake]
  );

  const selectedToken = useMemo(
    () => Maybe.of(enterRequest.selectedToken),
    [enterRequest.selectedToken]
  );

  const metadata = selectedStake.map((y) => y.metadata);

  const network = selectedToken.mapOrDefault((y) => y.symbol, "");

  const amount = useMemo(
    () => formatNumber(new BigNumber(enterRequest.requestDto.args.amount)),
    [enterRequest.requestDto.args.amount]
  );

  const yieldType = useYieldType(selectedStake).map((v) => v.type);

  const providerDetails = useProvidersDetails({
    integrationData: selectedStake,
    validatorsAddresses: Maybe.of(enterRequest.selectedValidators),
  });

  return (
    <CompletePage
      yieldType={yieldType}
      providersDetails={providerDetails}
      token={selectedToken}
      metadata={metadata}
      network={network}
      amount={amount}
    />
  );
};
