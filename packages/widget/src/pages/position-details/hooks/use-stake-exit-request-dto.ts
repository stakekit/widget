import type { ActionRequestDto, YieldDto } from "@stakekit/api-hooks";
import { Just, List, Maybe } from "purify-ts";
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
        const validatorsOrProvider = Just(null)
          .chain<
            | Pick<ActionRequestDto["args"], "validatorAddresses">
            | Pick<ActionRequestDto["args"], "validatorAddress" | "subnetId">
            | Pick<ActionRequestDto["args"], "providerId">
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
                  .chainNullable(() =>
                    val.integrationData.validators.find(
                      (v) => v.address === b.validator?.address
                    )
                  )
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
          dto: {
            addresses: {
              address: val.address,
              additionalAddresses: additionalAddresses ?? undefined,
            },
            integrationId: val.integrationData.id,
            args: {
              amount: unstakeAmount.toString(10),
              ...validatorsOrProvider,
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
    ]
  );
};
