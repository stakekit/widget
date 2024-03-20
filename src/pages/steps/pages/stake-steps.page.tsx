import { Maybe } from "purify-ts";
import { useTrackPage } from "../../../hooks/tracking/use-track-page";
import { useStakeState } from "../../../state/stake";
import { useSKWallet } from "../../../providers/sk-wallet";
import { importValidator } from "../../../common/import-validator";
import { useSetActionHistoryData } from "../../../providers/stake-history";
import { StepsPage } from "./common.page";

export const StakeStepsPage = () => {
  useTrackPage("stakingSteps");

  const { selectedStake, stakeSession, selectedValidators, stakeAmount } =
    useStakeState();

  const { address, network } = useSKWallet();

  const onSignSuccess = () =>
    Maybe.fromRecord({
      selectedStake,
      network: Maybe.fromNullable(network),
      address: Maybe.fromNullable(address),
    }).ifJust((val) =>
      selectedValidators.forEach((v) =>
        importValidator({
          validatorData: {
            integrationId: val.selectedStake.id,
            validator: v,
          },
          network: val.network,
          address: val.address,
        })
      )
    );

  const setActionHistoryData = useSetActionHistoryData();

  const onDone = () =>
    selectedStake.ifJust((val) => {
      setActionHistoryData({
        type: "stake",
        integrationData: val,
        amount: stakeAmount,
        selectedValidators,
        interactedToken: val.token,
      });
    });

  return (
    <StepsPage
      session={stakeSession}
      onSignSuccess={onSignSuccess}
      onDone={onDone}
    />
  );
};
