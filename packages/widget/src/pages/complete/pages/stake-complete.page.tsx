import { useStakeEnterData } from "@sk-widget/hooks/use-stake-enter-data";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import { formatNumber } from "../../../utils";
import { CompletePage } from "./common.page";

export const StakeCompletePage = () => {
  useTrackPage("stakeCompelete");

  const { stakeEnterData } = useStakeEnterData();

  const selectedStake = stakeEnterData.map((val) => val.selectedStake);
  const stakeAmount = stakeEnterData.map((val) => val.stakeAmount);
  const selectedValidators = stakeEnterData.map(
    (val) => val.selectedValidators
  );

  const token = stakeEnterData.map((y) => y.selectedToken);
  const metadata = selectedStake.map((y) => y.metadata);

  const network = token.mapOrDefault((y) => y.symbol, "");

  const amount = stakeAmount.mapOrDefault((a) => formatNumber(a), "");

  const yieldType = useYieldType(selectedStake).map((v) => v.type);

  const providerDetails = useProvidersDetails({
    integrationData: selectedStake,
    validatorsAddresses: selectedValidators,
  });

  return (
    <CompletePage
      yieldType={yieldType}
      providersDetails={providerDetails}
      token={token}
      metadata={metadata}
      network={network}
      amount={amount}
    />
  );
};