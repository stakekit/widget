import { Array as EArray, Option } from "effect";
import { useMemo } from "react";
import type { ActionCommand } from "../../../../../domain/schema/action-models";
import type { EarnYieldWithProvider } from "../../../../../domain/schema/earn-models";

import { getYieldActionArg } from "../../../../../domain/types/yields";
import { useSKWallet } from "../../../../wallet/react/use-wallet";
import type { PositionDetailsWorkflowState as State } from "../../../state/workflow";
import type { ExtraData } from "../state/types";

export const useStakeExitRequestDto = (
  workflow: Pick<
    State & ExtraData,
    | "integrationData"
    | "stakedOrLiquidBalances"
    | "unstakeAmount"
    | "unstakeUseMaxAmount"
  >
) => {
  const { address, additionalAddresses } = useSKWallet();
  const {
    unstakeAmount,
    unstakeUseMaxAmount,
    integrationData,
    stakedOrLiquidBalances,
  } = workflow;

  return useMemo((): {
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
