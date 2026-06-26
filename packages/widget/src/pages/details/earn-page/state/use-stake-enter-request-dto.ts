import type BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import type { YieldCreateActionDto } from "../../../../domain/types/action";
import type { AddressesDto } from "../../../../domain/types/addresses";
import type { TokenDto } from "../../../../domain/types/tokens";
import type { TronResourceType } from "../../../../domain/types/tron";
import { getYieldActionArg, type Yield } from "../../../../domain/types/yields";
import type { ValidatorDto } from "../../../../generated/api/yield";
import { useSKWallet } from "../../../../providers/sk-wallet";

export const useStakeEnterRequestDto = ({
  selectedProviderYieldId,
  selectedStake,
  selectedToken,
  selectedValidators,
  stakeAmount,
  tronResource,
  useMaxAmount,
}: {
  selectedProviderYieldId: Maybe<Yield["id"]>;
  selectedStake: Maybe<Yield>;
  selectedToken: Maybe<TokenDto>;
  selectedValidators: Map<ValidatorDto["address"], ValidatorDto>;
  stakeAmount: BigNumber;
  tronResource: Maybe<TronResourceType>;
  useMaxAmount: boolean;
}) => {
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

        if (providerIdRequired && !providerId) {
          return Maybe.empty();
        }

        const selectedProviderArgs = providerId ? { providerId } : {};

        const validatorsOrProvider = (() => {
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
            subnetId: subnetIdRequired ? v.subnet?.id : undefined,
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
              ...selectedProviderArgs,
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
