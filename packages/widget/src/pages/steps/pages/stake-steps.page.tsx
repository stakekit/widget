import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useEnterStakeRequest } from "../../../providers/enter-stake-store";
import { useSKWallet } from "../../../providers/wallet/react/use-wallet";
import { StepsPage } from "./common.page";

export const StakeStepsPage = () => {
  useTrackPage("stakingSteps");

  const { address, network } = useSKWallet();

  const enterRequest = useEnterStakeRequest()!;

  const onSignSuccess = () => ({ address, network });

  const providersDetails = useProvidersDetails({
    integrationData: enterRequest.selectedStake,
    validators: enterRequest.selectedValidators,
    selectedProviderYieldId: null,
  });

  return (
    <StepsPage
      inputToken={enterRequest.selectedToken}
      session={enterRequest.actionDto!}
      onSignSuccess={onSignSuccess}
      providersDetails={providersDetails}
    />
  );
};
