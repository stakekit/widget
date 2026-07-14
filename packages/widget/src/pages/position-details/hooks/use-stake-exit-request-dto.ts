import { Array as EArray, Option } from "effect";
import { useMemo } from "react";
import type { ActionCommand } from "../../../domain/schema/action-models";
import type { WalletAddresses } from "../../../domain/schema/address-models";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";

import { getYieldActionArg } from "../../../domain/types/yields";
import { useSKWallet } from "../../../providers/wallet/react/use-wallet";
import { useUnstakeOrPendingActionState } from "../state";

export const useStakeExitRequestDto = () => {
  const { address, additionalAddresses } = useSKWallet();
  const {
    unstakeAmount,
    unstakeUseMaxAmount,
    integrationData,
    stakedOrLiquidBalances,
  } = useUnstakeOrPendingActionState();

  return useMemo((): {
    addresses: WalletAddresses;
    gasFeeToken: EarnYieldWithProvider["token"];
    dto: ActionCommand;
  } | null => {
    if (!address || !integrationData || !stakedOrLiquidBalances) return null;

    const validatorsOrProvider:
      | Pick<NonNullable<ActionCommand["arguments"]>, "validatorAddresses">
      | Pick<
          NonNullable<ActionCommand["arguments"]>,
          "validatorAddress" | "subnetId"
        >
      | Record<string, never> = (() => {
      if (
        getYieldActionArg(integrationData, "exit", "validatorAddresses")
          ?.required
      ) {
        const balance = EArray.findFirst(
          stakedOrLiquidBalances,
          (b) => !!b.validators?.length
        ).pipe(Option.getOrNull);
        return balance
          ? {
              validatorAddresses:
                balance.validators?.map((validator) => validator.address) ?? [],
            }
          : {};
      }
      if (
        getYieldActionArg(integrationData, "exit", "validatorAddress")?.required
      ) {
        const balance = EArray.findFirst(
          stakedOrLiquidBalances,
          (b) => !!b.validator?.address
        ).pipe(Option.getOrNull);
        if (!balance?.validator?.address) return {};
        const subnetId = getYieldActionArg(integrationData, "exit", "subnetId")
          ?.required
          ? balance.validator.subnet?.id
          : undefined;
        return {
          validatorAddress: balance.validator.address,
          ...(subnetId === undefined ? {} : { subnetId }),
        };
      }

      return {};
    })();

    return {
      gasFeeToken: integrationData.mechanics.gasFeeToken,
      addresses: {
        address,
        additionalAddresses: additionalAddresses ?? undefined,
      },
      dto: {
        address,
        yieldId: integrationData.id,
        arguments: {
          amount: unstakeAmount.toString(10),
          ...(unstakeUseMaxAmount ? { useMaxAmount: true } : {}),
          ...validatorsOrProvider,
          ...(additionalAddresses ?? {}),
        },
      },
    };
  }, [
    additionalAddresses,
    address,
    stakedOrLiquidBalances,
    integrationData,
    unstakeAmount,
    unstakeUseMaxAmount,
  ]);
};
