import type {
  ActionArgumentsDto,
  ActionRequestDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useUnstakeOrPendingActionState } from "../state";

export const useStakeExitRequestDto = () => {
  const { address, additionalAddresses } = useSKWallet();
  const { unstakeAmount, integrationData, stakedOrLiquidBalances } =
    useUnstakeOrPendingActionState();

  return useMemo(
    () =>
      Maybe.fromRecord({
        address: Maybe.fromNullable(address),
        integrationData,
        stakedOrLiquidBalances,
      }).map<{
        gasFeeToken: YieldDto["token"];
        dto: ActionRequestDto;
      }>((val) => {
        const args: ActionArgumentsDto = {
          amount: unstakeAmount.toString(10),
        };

        if (val.integrationData.args.exit?.args?.validatorAddresses?.required) {
          args.validatorAddresses = List.find(
            (b) => !!b.validatorAddresses,
            val.stakedOrLiquidBalances
          )
            .map((b) => b.validatorAddresses)
            .extract();
        }

        if (val.integrationData.args.exit?.args?.validatorAddress?.required) {
          args.validatorAddress = List.find(
            (b) => !!b.validatorAddress,
            val.stakedOrLiquidBalances
          )
            .map((b) => b.validatorAddress)
            .extract();
        }

        return {
          gasFeeToken: val.integrationData.metadata.gasFeeToken,
          dto: {
            addresses: {
              address: val.address,
              additionalAddresses: additionalAddresses ?? undefined,
            },
            integrationId: val.integrationData.id,
            args,
          },
        };
      }),
    [
      additionalAddresses,
      address,
      stakedOrLiquidBalances,
      integrationData,
      unstakeAmount,
    ]
  );
};
