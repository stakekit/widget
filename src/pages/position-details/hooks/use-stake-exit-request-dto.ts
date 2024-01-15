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
  const { unstakeAmount, integrationData } = useUnstakeOrPendingActionState();

  return useMemo(
    () =>
      Maybe.fromRecord({
        address: Maybe.fromNullable(address),
        integrationData,
        balance,
      }).map<{
        gasFeeToken: YieldDto["token"];
        dto: ActionRequestDto;
      }>((val) => ({
        gasFeeToken: val.integrationData.metadata.gasFeeToken,
        dto: {
          addresses: {
            address: val.address,
            additionalAddresses: additionalAddresses ?? undefined,
          },
          integrationId: val.integrationData.id,
          args: {
            amount: unstakeAmount.toString(),
            ...(val.integrationData.args.exit?.args?.validatorAddresses
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
    [additionalAddresses, address, balance, integrationData, unstakeAmount]
  );
};
