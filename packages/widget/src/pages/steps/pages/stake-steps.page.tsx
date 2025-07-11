import { useSelector } from "@xstate/store/react";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useProvidersDetails } from "../../../hooks/use-provider-details";
import { useEnterStakeStore } from "../../../providers/enter-stake-store";
import { useSKWallet } from "../../../providers/sk-wallet";
import { StepsPage } from "./common.page";

export const StakeStepsPage = () => {
  useTrackPage("stakingSteps");

  const { address, network } = useSKWallet();

  const enterRequest = useSelector(
    useEnterStakeStore(),
    (state) => state.context.data
  ).unsafeCoerce();

  const onSignSuccess = () =>
    Maybe.fromRecord({
      network: Maybe.fromNullable(network),
      address: Maybe.fromNullable(address),
    });

  const providersDetails = useProvidersDetails({
    integrationData: useMemo(
      () => Maybe.of(enterRequest.selectedStake),
      [enterRequest.selectedStake]
    ),
    validatorsAddresses: useMemo(
      () => Maybe.of(enterRequest.selectedValidators),
      [enterRequest.selectedValidators]
    ),
    selectedProviderYieldId: Maybe.empty(),
  });

  return (
    <StepsPage
      session={enterRequest.actionDto.unsafeCoerce()}
      onSignSuccess={onSignSuccess}
      providersDetails={providersDetails}
    />
  );
};
