import { Just, List, Maybe } from "purify-ts";
import { useMemo } from "react";
import type { YieldCreateActionDto } from "../../../domain/types/action";
import type { AddressesDto } from "../../../domain/types/addresses";
import {
  getYieldActionArg,
  getYieldGasFeeToken,
  isYieldIntegrationAggregator,
  type Yield,
} from "../../../domain/types/yields";
import { useSKWallet } from "../../../providers/sk-wallet";
import { withAdditionalAddresses } from "../../../providers/yield-api-client-provider/request-helpers";
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
            | Pick<NonNullable<YieldCreateActionDto["arguments"]>, "providerId">
          >(() => {
            if (isYieldIntegrationAggregator(val.integrationData)) {
              return List.find(
                (b) => !!b.validator?.providerId,
                val.stakedOrLiquidBalances,
              ).map((b) => ({
                providerId: b.validator?.providerId,
                validatorAddress: b.validator?.address,
              }));
            }
            if (
              getYieldActionArg(
                val.integrationData,
                "exit",
                "validatorAddresses",
              )?.required
            ) {
              return List.find(
                (b) => !!b.validators?.length,
                val.stakedOrLiquidBalances,
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
                val.stakedOrLiquidBalances,
              ).map((b) => {
                const subnetId = Maybe.fromNullable(
                  getYieldActionArg(val.integrationData, "exit", "subnetId")
                    ?.required,
                )
                  .chainNullable(() => b.validator)
                  .map((validator) => validator.subnetId)
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
          gasFeeToken: getYieldGasFeeToken(val.integrationData),
          addresses: {
            address: val.address,
            additionalAddresses: additionalAddresses ?? undefined,
          },
          dto: {
            address: val.address,
            yieldId: val.integrationData.id,
            arguments: withAdditionalAddresses({
              additionalAddresses,
              argumentsDto: {
                amount: unstakeAmount.toString(10),
                useMaxAmount: unstakeUseMaxAmount || undefined,
                ...validatorsOrProvider,
              },
            }),
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
    ],
  );
};
