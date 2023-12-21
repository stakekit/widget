import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useYieldType } from "../../../hooks/use-yield-type";
import { useActionHistoryData } from "../../../providers/stake-history";
import { formatNumber } from "../../../utils";
import { CompletePage } from "./common.page";

export const StakeCompletePage = () => {
  useTrackPage("stakeCompelete");

  const stakeHistoryData = useActionHistoryData().chainNullable((val) =>
    val.type === "stake" ? val : null
  );

  const selectedStake = stakeHistoryData.map((val) => val.selectedStake);
  const stakeAmount = stakeHistoryData.map((val) => val.stakeAmount);
  const selectedValidators = stakeHistoryData.map(
    (val) => val.selectedValidators
  );

  const token = selectedStake.map((y) => y.token);
  const metadata = selectedStake.map((y) => y.metadata);

  const network = selectedStake.mapOrDefault((y) => y.token.symbol, "");

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
