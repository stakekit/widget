import { Maybe } from "purify-ts";
import { importValidator } from "../../common/import-validator";
import { useStakeState } from "../../state/stake";
import { StepsPage } from "./common.page";
import { useSKWallet } from "../../providers/sk-wallet";
import { useTrackPage } from "../../hooks/tracking/use-track-page";
import { useSetStakeHistoryData } from "../../providers/stake-history";

export const StakeStepsPage = () => {
  useTrackPage("stakingSteps");

  const { selectedStake, stakeSession, selectedValidator, stakeAmount } =
    useStakeState();

  const { address, network } = useSKWallet();

  const onSignSuccess = () => {
    Maybe.fromRecord({
      selectedStake,
      selectedValidator,
      network: Maybe.fromNullable(network),
      address: Maybe.fromNullable(address),
    }).ifJust((val) => {
      importValidator({
        validatorData: {
          integrationId: val.selectedStake.id,
          validator: val.selectedValidator,
        },
        network: val.network,
        address: val.address,
      });
    });
  };

  const setStakeHistoryData = useSetStakeHistoryData();

  const onDone = () => {
    Maybe.fromRecord({ selectedStake, stakeAmount }).ifJust((val) => {
      setStakeHistoryData(
        Maybe.of({
          selectedStake: val.selectedStake,
          stakeAmount: val.stakeAmount,
          selectedValidator,
        })
      );
    });
  };

  return (
    <StepsPage
      session={stakeSession}
      onSignSuccess={onSignSuccess}
      onDone={onDone}
    />
  );
};
