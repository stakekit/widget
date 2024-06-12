import { useEnterStakeRequestDto } from "@sk-widget/providers/enter-stake-request-dto";
import { Maybe } from "purify-ts";
import { importValidator } from "../../../common/import-validator";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useSKWallet } from "../../../providers/sk-wallet";
import { StepsPage } from "./common.page";

export const StakeStepsPage = () => {
  useTrackPage("stakingSteps");

  const { address, network } = useSKWallet();

  const state = useEnterStakeRequestDto();

  const onSignSuccess = () =>
    Maybe.fromRecord({
      state: Maybe.fromNullable(state),
      network: Maybe.fromNullable(network),
      address: Maybe.fromNullable(address),
    }).ifJust((val) =>
      val.state.selectedValidators.forEach((v) =>
        importValidator({
          validatorData: {
            integrationId: val.state.selectedStake.id,
            validator: v,
          },
          network: val.network,
          address: val.address,
        })
      )
    );

  return (
    <StepsPage
      session={Maybe.fromNullable(state?.actionDto)}
      onSignSuccess={onSignSuccess}
    />
  );
};
