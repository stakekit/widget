import { useEnterStakeStore } from "@sk-widget/providers/enter-stake-store";
import { useSelector } from "@xstate/store/react";
import { Maybe } from "purify-ts";
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

  return (
    <StepsPage
      session={enterRequest.actionDto.unsafeCoerce()}
      onSignSuccess={onSignSuccess}
    />
  );
};
