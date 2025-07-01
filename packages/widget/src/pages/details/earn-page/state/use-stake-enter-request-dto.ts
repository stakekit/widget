import type {
  ActionRequestDto,
  ValidatorDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { Just, List, Maybe } from "purify-ts";
import { useMemo } from "react";
import {
  isEigenRestaking,
  p2pProviderId,
} from "../../../../domain/types/yields";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { useEarnPageState } from "./earn-page-state-context";

export const useStakeEnterRequestDto = () => {
  const {
    selectedStake,
    stakeAmount,
    selectedValidators,
    tronResource,
    selectedToken,
  } = useEarnPageState();
  const { address, additionalAddresses, isLedgerLive } = useSKWallet();

  return useMemo(
    () =>
      Maybe.fromRecord({
        address: Maybe.fromNullable(address),
        selectedStake,
        selectedToken,
      }).map<{
        gasFeeToken: YieldDto["token"];
        dto: ActionRequestDto;
        selectedValidators: Map<string, ValidatorDto>;
        selectedStake: YieldDto;
      }>(({ address, selectedStake, selectedToken }) => {
        const validatorsOrProvider = Just(selectedStake)
          .chain<
            | Pick<ActionRequestDto["args"], "validatorAddresses">
            | Pick<ActionRequestDto["args"], "validatorAddress" | "subnetId">
            | Pick<ActionRequestDto["args"], "providerId">
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
          dto: {
            addresses: {
              address: address,
              additionalAddresses: additionalAddresses ?? undefined,
            },
            integrationId: selectedStake.id,
            args: {
              inputToken: selectedToken,
              ledgerWalletAPICompatible: isLedgerLive ?? undefined,
              tronResource: tronResource.extract(),
              amount: stakeAmount.toString(10),
              ...(isEigenRestaking(selectedStake) && {
                providerId: p2pProviderId,
              }),
              ...validatorsOrProvider,
            },
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
    ]
  );
};
