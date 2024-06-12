import { useStakeEnterData } from "@sk-widget/hooks/use-stake-enter-data";
import { Maybe } from "purify-ts";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import { formatNumber } from "../../../utils";
import { CompletePage } from "./common.page";

export const StakeCompletePage = () => {
  useTrackPage("stakeCompelete");

  const { selectedStake, stakeAmount, selectedValidators, selectedToken } =
    useStakeEnterData();

  const metadata = selectedStake.map((y) => y.metadata);

  const network = selectedToken.mapOrDefault((y) => y.symbol, "");

  const amount = Maybe.of(stakeAmount).mapOrDefault((a) => formatNumber(a), "");

  const yieldType = useYieldType(selectedStake).map((v) => v.type);

  const providerDetails = useProvidersDetails({
    integrationData: selectedStake,
    validatorsAddresses: Maybe.of(selectedValidators),
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
