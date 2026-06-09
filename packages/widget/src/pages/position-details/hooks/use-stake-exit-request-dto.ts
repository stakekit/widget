import { Just, List, Maybe } from "purify-ts";
import { useMemo } from "react";
import type { YieldCreateActionDto } from "../../../domain/types/action";
import type { AddressesDto } from "../../../domain/types/addresses";
import { getYieldActionArg, type Yield } from "../../../domain/types/yields";
import { useSKWallet } from "../../../providers/sk-wallet";
import { useUnstakeOrPendingActionState } from "../state";

export const useStakeExitRequestDto = () => {
  const { address, additionalAddresses } = useSKWallet();
  const {
    unstakeAmount,
    unstakeUseMaxAmount,
    integrationData,
    stakedOrLiquidBalances,
  } = useUnstakeOrPendingActionState();

  return useMemo(
    () =>
      Maybe.fromRecord({
        address: Maybe.fromNullable(address),
        integrationData,
        stakedOrLiquidBalances,
      }).map<{
        addresses: AddressesDto;
        gasFeeToken: Yield["token"];
        dto: YieldCreateActionDto;
      }>((val) => {
        const validatorsOrProvider = Just(null)
          .chain<
            | Pick<
                NonNullable<YieldCreateActionDto["arguments"]>,
                "validatorAddresses"
              >
            | Pick<
                NonNullable<YieldCreateActionDto["arguments"]>,
                "validatorAddress" | "subnetId"
              >
          >(() => {
            if (
              getYieldActionArg(
                val.integrationData,
                "exit",
                "validatorAddresses"
              )?.required
            ) {
              return List.find(
                (b) => !!b.validators?.length,
                val.stakedOrLiquidBalances
              ).map((b) => ({
                validatorAddresses:
                  b.validators?.map((validator) => validator.address) ?? [],
              }));
            }
            if (
              getYieldActionArg(val.integrationData, "exit", "validatorAddress")
                ?.required
            ) {
              return List.find(
                (b) => !!b.validator?.address,
                val.stakedOrLiquidBalances
              ).map((b) => {
                const subnetId = Maybe.fromNullable(
                  getYieldActionArg(val.integrationData, "exit", "subnetId")
                    ?.required
                )
                  .chainNullable(() => b.validator)
                  .chainNullable((validator) => validator.subnet?.id)
                  .extract();

                return {
                  validatorAddress: b.validator?.address,
                  subnetId,
                };
              });
            }

            return Maybe.empty();
          })
          .orDefault({});

        return {
          gasFeeToken: val.integrationData.mechanics.gasFeeToken,
          addresses: {
            address: val.address,
            additionalAddresses: additionalAddresses ?? undefined,
          },
          dto: {
            address: val.address,
            yieldId: val.integrationData.id,
            arguments: {
              amount: unstakeAmount.toString(10),
              useMaxAmount: unstakeUseMaxAmount || undefined,
              ...validatorsOrProvider,
              ...(additionalAddresses ?? {}),
            },
          },
        };
      }),
    [
      additionalAddresses,
      address,
      stakedOrLiquidBalances,
      integrationData,
      unstakeAmount,
      unstakeUseMaxAmount,
    ]
  );
};
