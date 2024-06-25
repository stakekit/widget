import { useEnterStakeState } from "@sk-widget/providers/enter-stake-state";
import { Maybe } from "purify-ts";
import { importValidator } from "../../../common/import-validator";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useSKWallet } from "../../../providers/sk-wallet";
import { StepsPage } from "./common.page";

export const StakeStepsPage = () => {
  useTrackPage("stakingSteps");

  const { address, network } = useSKWallet();

  const enterRequest = useEnterStakeState().unsafeCoerce();

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
    <StepsPage session={enterRequest.actionDto} onSignSuccess={onSignSuccess} />
  );
};
