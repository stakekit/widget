import { useMemo } from "react";
import { List, Maybe } from "purify-ts";
import {
  ActionRequestDto,
  TronResourceArgumentOptionsDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { useStakeState } from "../../../../state/stake";
import { useSKWallet } from "../../../../providers/sk-wallet";

export const useStakeEnterRequestDto = () => {
  const { selectedStake, stakeAmount, selectedValidators, tronResource } =
    useStakeState();
  const { address, additionalAddresses, isLedgerLive } = useSKWallet();

  return useMemo(
    () =>
      selectedStake
        .chain((v) =>
          Maybe.fromNullable(address).map((a) => ({
            stake: v,
            address: a,
            tronResource: tronResource.extract(),
          }))
        )
        .filter(
          (val) =>
            !(
              val.stake.args.enter.args?.tronResource as
                | TronResourceArgumentOptionsDto
                | undefined
            )?.required || !!val.tronResource
        )
        .map<{
          gasFeeToken: YieldDto["token"];
          dto: ActionRequestDto;
        }>((val) => {
          return {
            gasFeeToken: val.stake.metadata.gasFeeToken,
            dto: {
              addresses: {
                address: val.address,
                additionalAddresses: additionalAddresses ?? undefined,
              },
              integrationId: val.stake.id,
              args: {
                ledgerWalletAPICompatible: isLedgerLive ?? undefined,
                tronResource: val.tronResource,
                amount: stakeAmount.toString(),
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
          };
        }),
    [
      selectedStake,
      stakeAmount,
      address,
      additionalAddresses,
      isLedgerLive,
      tronResource,
      selectedValidators,
    ]
  );
};
