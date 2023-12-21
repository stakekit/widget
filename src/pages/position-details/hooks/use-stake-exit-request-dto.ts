import { useMemo } from "react";
import { List, Maybe } from "purify-ts";
import { useStakedOrLiquidBalance } from "../../../hooks/use-staked-or-liquid-balance";
import { useUnstakeOrPendingActionState } from "../../../state/unstake-or-pending-action";
import { ActionRequestDto, YieldDto } from "@stakekit/api-hooks";
import { useSKWallet } from "../../../providers/sk-wallet";

export const useStakeExitRequestDto = ({
  balance,
}: {
  balance: ReturnType<typeof useStakedOrLiquidBalance>;
}) => {
  const { address, additionalAddresses } = useSKWallet();
  const { unstake } = useUnstakeOrPendingActionState();

  return useMemo(
    () =>
      Maybe.fromRecord({
        address: Maybe.fromNullable(address),
        unstake,
        unstakeAmount: unstake.chain((val) => val.amount),
        balance,
      }).map<{
        gasFeeToken: YieldDto["token"];
        dto: ActionRequestDto;
      }>((val) => ({
        gasFeeToken: val.unstake.integration.metadata.gasFeeToken,
        dto: {
          addresses: {
            address: val.address,
            additionalAddresses: additionalAddresses ?? undefined,
          },
          integrationId: val.unstake.integration.id,
          args: {
            amount: val.unstakeAmount.toString(),
            ...(val.unstake.integration.args.exit?.args?.validatorAddresses
              ?.required
              ? {
                  validatorAddresses: List.find(
                    (b) => !!b.validatorAddresses,
                    val.balance
                  )
                    .map((b) => b.validatorAddresses)
                    .extract(),
                }
              : {
                  validatorAddress: List.find(
                    (b) => !!b.validatorAddresses,
                    val.balance
                  )
                    .map((b) => b.validatorAddress)
                    .extract(),
                }),
          },
        },
      })),
    [additionalAddresses, address, balance, unstake]
  );
};
