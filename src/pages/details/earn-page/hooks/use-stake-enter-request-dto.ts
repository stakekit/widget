import { useMemo } from "react";
import { List, Maybe } from "purify-ts";
import { ActionRequestDto, YieldDto } from "@stakekit/api-hooks";
import { useStakeState } from "../../../../state/stake";
import { useSKWallet } from "../../../../providers/sk-wallet";

export const useStakeEnterRequestDto = () => {
  const { selectedStake, stakeAmount, selectedValidators } = useStakeState();
  const { address, additionalAddresses, isLedgerLive } = useSKWallet();

  return useMemo(
    () =>
      selectedStake
        .chain((stake) => stakeAmount.map((amount) => ({ stake, amount })))
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
              ...(val.stake.args.enter.args?.validatorAddresses?.required
                ? {
                    validatorAddresses: [...selectedValidators.values()].map(
                      (v) => v.address
                    ),
                  }
                : {
                    validatorAddress: List.head([
                      ...selectedValidators.values(),
                    ])
                      .map((v) => v.address)
                      .extract(),
                  }),
            },
          },
        })),
    [
      selectedStake,
      stakeAmount,
      selectedValidators,
      address,
      additionalAddresses,
      isLedgerLive,
    ]
  );
};
