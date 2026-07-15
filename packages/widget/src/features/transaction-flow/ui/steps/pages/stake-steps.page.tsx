import { useProvidersDetails } from "../../../../earn";
import { useTrackPage } from "../../../../tracking";
import { useSKWallet } from "../../../../wallet";
import { useEnterStakeRequest } from "../../../react/use-transaction-flow";
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
