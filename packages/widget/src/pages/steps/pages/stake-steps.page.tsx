import { useProvidersDetails } from "@sk-widget/hooks/use-provider-details";
import { useEnterStakeStore } from "@sk-widget/providers/enter-stake-store";
import { useSelector } from "@xstate/store/react";
import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { importValidator } from "../../../common/import-validator";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
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
    }).ifJust((val) =>
      enterRequest.selectedValidators.forEach((v) =>
        importValidator({
          validatorData: {
            integrationId: enterRequest.selectedStake.id,
            validator: v,
          },
          network: val.network,
          address: val.address,
        })
      )
    );

  const providersDetails = useProvidersDetails({
    integrationData: useMemo(
      () => Maybe.of(enterRequest.selectedStake),
      [enterRequest.selectedStake]
    ),
    validatorsAddresses: useMemo(
      () => Maybe.of(enterRequest.selectedValidators),
      [enterRequest.selectedValidators]
    ),
  });

  return (
    <StepsPage
      session={enterRequest.actionDto.unsafeCoerce()}
      onSignSuccess={onSignSuccess}
      providersDetails={providersDetails}
    />
  );
};
