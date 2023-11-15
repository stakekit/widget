import { useTrackPage } from "../../hooks/tracking/use-track-page";
import { useProviderDetails } from "../../hooks/use-provider-details";
import { useYieldType } from "../../hooks/use-yield-type";
import { useStakeHistoryData } from "../../providers/stake-history";
import { formatNumber } from "../../utils";
import { CompletePage } from "./common.page";

export const StakeCompletePage = () => {
  useTrackPage("stakeCompelete");

  const stakeHistoryData = useStakeHistoryData();

  const selectedStake = stakeHistoryData.map((val) => val.selectedStake);
  const stakeAmount = stakeHistoryData.map((val) => val.stakeAmount);
  const selectedValidator = stakeHistoryData.chain(
    (val) => val.selectedValidator
  );

  const token = selectedStake.map((y) => y.token);
  const metadata = selectedStake.map((y) => y.metadata);

  const network = selectedStake.mapOrDefault((y) => y.token.symbol, "");

  const amount = stakeAmount.mapOrDefault((a) => formatNumber(a), "");

  const yieldType = useYieldType(selectedStake).map((v) => v.type);

  const providerDetails = useProviderDetails({
    integrationData: selectedStake,
    validatorAddress: selectedValidator.map((v) => v.address),
  });

  return (
    <CompletePage
      yieldType={yieldType}
      providerDetails={providerDetails}
      token={token}
      metadata={metadata}
      network={network}
      amount={amount}
    />
  );
};
