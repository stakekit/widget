import { Maybe } from "purify-ts";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useSKWallet } from "../../../providers/sk-wallet";
import { importValidator } from "../../../common/import-validator";
import { StepsPage } from "./common.page";
import { useStakeEnterData } from "@sk-widget/hooks/use-stake-enter-data";

export const StakeStepsPage = () => {
  useTrackPage("stakingSteps");

  const { address, network } = useSKWallet();

  const { stakeSession, stakeEnterData } = useStakeEnterData();

  const onSignSuccess = () =>
    Maybe.fromRecord({
      stakeEnterData,
      network: Maybe.fromNullable(network),
      address: Maybe.fromNullable(address),
    }).ifJust((val) =>
      val.stakeEnterData.selectedValidators.forEach((v) =>
        importValidator({
          validatorData: {
            integrationId: val.stakeEnterData.selectedStake.id,
            validator: v,
          },
          network: val.network,
          address: val.address,
        })
      )
    );

  return <StepsPage session={stakeSession} onSignSuccess={onSignSuccess} />;
};
