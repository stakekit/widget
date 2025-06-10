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
                (b) => !!b.providerId,
                val.stakedOrLiquidBalances
              ).map((b) => ({
                providerId: b.providerId,
                validatorAddress: b.validatorAddress,
              }));
            }
            if (
              val.integrationData.args.exit?.args?.validatorAddresses?.required
            ) {
              return List.find(
                (b) => !!b.validatorAddresses,
                val.stakedOrLiquidBalances
              ).map((b) => ({ validatorAddresses: b.validatorAddresses }));
            }
            if (
              val.integrationData.args.exit?.args?.validatorAddress?.required
            ) {
              return List.find(
                (b) => !!b.validatorAddress,
                val.stakedOrLiquidBalances
              ).map((b) => {
                const subnetId = Maybe.fromNullable(
                  val.integrationData.args.exit?.args?.subnetId?.required
                )
                  .chainNullable(() =>
                    val.integrationData.validators.find(
                      (v) => v.address === b.validatorAddress
                    )
                  )
                  .map((validator) => validator.subnetId)
                  .extract();

                return {
                  validatorAddress: b.validatorAddress,
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
