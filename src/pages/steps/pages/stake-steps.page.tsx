import { useStakeEnterData } from "@sk-widget/hooks/use-stake-enter-data";
import { Maybe } from "purify-ts";
import { importValidator } from "../../../common/import-validator";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useSKWallet } from "../../../providers/sk-wallet";
import { StepsPage } from "./common.page";

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
