import { useMemo } from "react";
import { Maybe } from "purify-ts";
import { ActionRequestDto, YieldDto } from "@stakekit/api-hooks";
import { useStakeState } from "../../../../state/stake";
import { useSKWallet } from "../../../../providers/sk-wallet";

export const useStakeEnterRequestDto = () => {
  const { selectedStake, stakeAmount, selectedValidator } = useStakeState();
  const { address, additionalAddresses, isLedgerLive } = useSKWallet();

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
        .map<{
          gasFeeToken: YieldDto["token"];
          dto: ActionRequestDto;
        }>((val) => ({
          gasFeeToken: val.stake.metadata.gasFeeToken,
          dto: {
            addresses: {
              address: val.address,
              additionalAddresses: additionalAddresses ?? undefined,
            },
            integrationId: val.stake.id,
            args: {
              ledgerWalletAPICompatible: isLedgerLive ?? undefined,
              amount: val.amount.toString(),
              validatorAddress:
                val.validator?.address ?? val.stake.metadata.defaultValidator,
            },
          },
        })),
    [
      selectedStake,
      stakeAmount,
      selectedValidator,
      address,
      additionalAddresses,
      isLedgerLive,
    ]
  );
};
