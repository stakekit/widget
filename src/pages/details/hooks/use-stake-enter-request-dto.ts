import { useMemo } from "react";
import { Maybe } from "purify-ts";
import { useSKWallet } from "../../../hooks/use-sk-wallet";
import { StakeRequestDto, YieldOpportunityDto } from "@stakekit/api-hooks";
import { useStakeState } from "../../../state/stake";

export const useStakeEnterRequestDto = () => {
  const { selectedStake, stakeAmount, selectedValidator } = useStakeState();
  const { address, additionalAddresses } = useSKWallet();

  return useMemo(
    () =>
      selectedStake
        .chain((stake) =>
          stakeAmount.map((amount) => ({
            stake,
            amount,
            validator: selectedValidator.extractNullable(),
          }))
        )
        .chain((v) =>
          Maybe.fromNullable(address).map((a) => ({ ...v, address: a }))
        )
        .map<
          StakeRequestDto & {
            gasFeeToken: YieldOpportunityDto["token"]; // TODO: change this on api-hooks update
          }
        >((val) => ({
          // @ts-expect-error
          gasFeeToken: val.stake.metadata.gasFeeToken,
          addresses: {
            address: val.address,
            additionalAddresses: additionalAddresses ?? undefined,
          },
          integrationId: val.stake.id,
          args: {
            amount: val.amount.toString(),
            validatorAddress: val.validator?.address,
          },
        })),
    [
      address,
      selectedStake,
      selectedValidator,
      stakeAmount,
      additionalAddresses,
    ]
  );
};
