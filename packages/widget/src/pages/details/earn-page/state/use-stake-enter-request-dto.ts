import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import type { YieldCreateActionDto } from "../../../../domain/types/action";
import type { AddressesDto } from "../../../../domain/types/addresses";
import type { ValidatorDto } from "../../../../domain/types/validators";
import {
  getYieldActionArg,
  isYieldIntegrationAggregator,
  type Yield,
} from "../../../../domain/types/yields";
import { useSKWallet } from "../../../../providers/sk-wallet";
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
      }).chain<{
        addresses: AddressesDto;
        gasFeeToken: Yield["token"];
        dto: YieldCreateActionDto;
        selectedValidators: Map<string, ValidatorDto>;
        selectedStake: Yield;
      }>(({ address, selectedStake, selectedToken }) => {
        const validators = [...selectedValidators.values()];
        const providerIdRequired = !!getYieldActionArg(
          selectedStake,
          "enter",
          "providerId"
        )?.required;
        const providerId = selectedProviderYieldId.extract();

        if (
          providerIdRequired &&
          !providerId &&
          !isYieldIntegrationAggregator(selectedStake)
        ) {
          return Maybe.empty();
        }

        const validatorsOrProvider = (() => {
          if (isYieldIntegrationAggregator(selectedStake)) {
            return List.head(validators).map((v) => ({
              providerId: v.providerId,
            }));
          }

          if (
            getYieldActionArg(selectedStake, "enter", "validatorAddresses")
              ?.required
          ) {
            return validators.length > 0
              ? Maybe.of({
                  validatorAddresses: validators.map((v) => v.address),
                })
              : Maybe.empty();
          }

          const subnetIdRequired = !!getYieldActionArg(
            selectedStake,
            "enter",
            "subnetId"
          )?.required;

          const validatorAddressRequired = !!getYieldActionArg(
            selectedStake,
            "enter",
            "validatorAddress"
          )?.required;

          if (!validatorAddressRequired && !subnetIdRequired) {
            return Maybe.of({});
          }

          return List.head(validators).map((v) => ({
            validatorAddress: v.address,
            subnetId: subnetIdRequired ? v.subnetId : undefined,
          }));
        })();

        return validatorsOrProvider.map((validatorsOrProvider) => ({
          selectedValidators,
          selectedStake: selectedStake,
          gasFeeToken: selectedStake.mechanics.gasFeeToken,
          addresses: {
            address,
            additionalAddresses: additionalAddresses ?? undefined,
          },
          dto: {
            address,
            yieldId: selectedStake.id,
            arguments: {
              inputToken: selectedToken.address,
              ledgerWalletApiCompatible: isLedgerLive ?? undefined,
              tronResource: tronResource.extract(),
              amount: stakeAmount.toString(10),
              useMaxAmount: useMaxAmount || undefined,
              providerId,
              ...validatorsOrProvider,
              ...(additionalAddresses ?? {}),
            },
          },
        }));
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
