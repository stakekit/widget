import type { AddressesDto, ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import { Just, List, Maybe } from "purify-ts";
import { useMemo } from "react";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { withAdditionalAddresses } from "../../../../providers/yield-api-client-provider/request-helpers";
import type { YieldCreateActionDto } from "../../../../providers/yield-api-client-provider/types";
import { useEarnPageState } from "./earn-page-state-context";

export const useStakeEnterRequestDto = () => {
  const {
    selectedStake,
    stakeAmount,
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
        gasFeeToken: YieldDto["token"];
        dto: YieldCreateActionDto;
        selectedValidators: Map<string, ValidatorDto>;
        selectedStake: YieldDto;
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

            if (val.metadata.isIntegrationAggregator) {
              return List.head(validators).map((v) => ({
                providerId: v.providerId,
              }));
            }
            if (val.args.enter.args?.validatorAddresses?.required) {
              return Just({
                validatorAddresses: validators.map((v) => v.address),
              });
            }

            const subnetIdRequired =
              !!selectedStake.args.enter.args?.subnetId?.required;

            return List.head(validators).map((v) => ({
              validatorAddress: v.address,
              subnetId: subnetIdRequired ? v.subnetId : undefined,
            }));
          })
          .orDefault({});

        return {
          selectedValidators,
          selectedStake: selectedStake,
          gasFeeToken: selectedStake.metadata.gasFeeToken,
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
      tronResource,
      selectedProviderYieldId,
    ]
  );
};
