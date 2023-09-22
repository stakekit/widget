import { Maybe } from "purify-ts";
import { importValidator } from "../../common/import-validator";
import { useSKWallet } from "../../hooks/wallet/use-sk-wallet";
import { useStakeState } from "../../state/stake";
import { StepsPage } from "./common.page";

export const StakeStepsPage = () => {
  const { selectedStake, stakeSession, selectedValidator } = useStakeState();

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

  return <StepsPage session={stakeSession} onSignSuccess={onSignSuccess} />;
};
