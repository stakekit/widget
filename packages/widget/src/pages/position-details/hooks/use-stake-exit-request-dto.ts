import type { AddressesDto, YieldDto } from "@stakekit/api-hooks";
import { Just, List, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useSKWallet } from "../../../providers/sk-wallet";
import { withAdditionalAddresses } from "../../../providers/yield-api-client-provider/request-helpers";
import type { YieldCreateActionDto } from "../../../providers/yield-api-client-provider/types";
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
        addresses: AddressesDto;
        gasFeeToken: YieldDto["token"];
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
            if (val.integrationData.metadata.isIntegrationAggregator) {
              return List.find(
                (b) => !!b.validator?.providerId,
                val.stakedOrLiquidBalances
              ).map((b) => ({
                providerId: b.validator?.providerId,
                validatorAddress: b.validator?.address,
              }));
            }
            if (
              val.integrationData.args.exit?.args?.validatorAddresses?.required
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
              val.integrationData.args.exit?.args?.validatorAddress?.required
            ) {
              return List.find(
                (b) => !!b.validator?.address,
                val.stakedOrLiquidBalances
              ).map((b) => {
                const subnetId = Maybe.fromNullable(
                  val.integrationData.args.exit?.args?.subnetId?.required
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
          gasFeeToken: val.integrationData.metadata.gasFeeToken,
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
    ]
  );
};
