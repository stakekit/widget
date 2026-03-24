import { Just, List, Maybe } from "purify-ts";
import { useMemo } from "react";
import type { YieldCreateActionDto } from "../../../../domain/types/action";
import type { AddressesDto } from "../../../../domain/types/addresses";
import type { ValidatorDto } from "../../../../domain/types/validators";
import {
  getYieldActionArg,
  getYieldGasFeeToken,
  isYieldIntegrationAggregator,
  type Yield,
} from "../../../../domain/types/yields";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { withAdditionalAddresses } from "../../../../providers/yield-api-client-provider/request-helpers";
import { useEarnPageState } from "./earn-page-state-context";

export const useStakeEnterRequestDto = () => {
  const {
    selectedStake,
    stakeAmount,
    useMaxAmount,
    selectedValidators,
    tronResource,
    selectedToken,
    selectedProviderYieldId,
  } = useEarnPageState();
  const { address, additionalAddresses, isLedgerLive } = useSKWallet();

  return useMemo(
    () =>
      Maybe.fromRecord({
        address: Maybe.fromNullable(address),
        selectedStake,
        selectedToken,
      }).map<{
        addresses: AddressesDto;
        gasFeeToken: Yield["token"];
        dto: YieldCreateActionDto;
        selectedValidators: Map<string, ValidatorDto>;
        selectedStake: Yield;
      }>(({ address, selectedStake, selectedToken }) => {
        const validatorsOrProvider = Just(selectedStake)
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
          >((val) => {
            const validators = [...selectedValidators.values()];

            if (isYieldIntegrationAggregator(val)) {
              return List.head(validators).map((v) => ({
                providerId: v.providerId,
              }));
            }
            if (
              getYieldActionArg(val, "enter", "validatorAddresses")?.required
            ) {
              return Just({
                validatorAddresses: validators.map((v) => v.address),
              });
            }

            const subnetIdRequired = !!getYieldActionArg(
              selectedStake,
              "enter",
              "subnetId"
            )?.required;

            return List.head(validators).map((v) => ({
              validatorAddress: v.address,
              subnetId: subnetIdRequired ? v.subnetId : undefined,
            }));
          })
          .orDefault({});

        return {
          selectedValidators,
          selectedStake: selectedStake,
          gasFeeToken: getYieldGasFeeToken(selectedStake),
          addresses: {
            address,
            additionalAddresses: additionalAddresses ?? undefined,
          },
          dto: {
            address,
            yieldId: selectedStake.id,
            arguments: withAdditionalAddresses({
              additionalAddresses,
              argumentsDto: {
                inputToken: selectedToken.address,
                ledgerWalletApiCompatible: isLedgerLive ?? undefined,
                tronResource: tronResource.extract(),
                amount: stakeAmount.toString(10),
                useMaxAmount: useMaxAmount || undefined,
                providerId: selectedProviderYieldId.extract(),
                ...validatorsOrProvider,
              },
            }),
          },
        };
      }),
    [
      additionalAddresses,
      address,
      isLedgerLive,
      selectedStake,
      selectedToken,
      selectedValidators,
      stakeAmount,
      useMaxAmount,
      tronResource,
      selectedProviderYieldId,
    ]
  );
};
