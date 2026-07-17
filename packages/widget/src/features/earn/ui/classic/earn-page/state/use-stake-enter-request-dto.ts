import type BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import { useMemo } from "react";
import type { ActionCommand } from "../../../../../../domain/schema/action-models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../../../domain/schema/earn-models";
import type { YieldId } from "../../../../../../domain/schema/identifiers";
import type {
  AppToken,
  TronResource,
} from "../../../../../../domain/schema/legacy-models";

import type { ValidatorKey } from "../../../../../../domain/types/validators";
import { getYieldActionArg } from "../../../../../../domain/types/yields";
import { useSKWallet } from "../../../../../wallet";

export const useStakeEnterRequestDto = ({
  selectedProviderYieldId,
  selectedStake,
  selectedToken,
  selectedValidators,
  stakeAmount,
  tronResource,
  useMaxAmount,
}: {
  selectedProviderYieldId: YieldId | null;
  selectedStake: EarnYieldWithProvider | null;
  selectedToken: AppToken | null;
  selectedValidators: Map<ValidatorKey, EarnValidator>;
  stakeAmount: BigNumber;
  tronResource: TronResource | null;
  useMaxAmount: boolean;
}) => {
  const { address, additionalAddresses, isLedgerLive } = useSKWallet();

  return useMemo<{
    gasFeeToken: EarnYieldWithProvider["token"];
    dto: ActionCommand;
    selectedValidators: Map<ValidatorKey, EarnValidator>;
    selectedStake: EarnYieldWithProvider;
  } | null>(() => {
    if (!address || !selectedStake || !selectedToken) return null;

    const providerIdRequired = !!getYieldActionArg(
      selectedStake,
      "enter",
      "providerId"
    )?.required;
    if (providerIdRequired && !selectedProviderYieldId) return null;

    const validators = [...selectedValidators.values()];
    const validatorArguments = (() => {
      if (
        getYieldActionArg(selectedStake, "enter", "validatorAddresses")
          ?.required
      ) {
        return validators.length > 0
          ? { validatorAddresses: validators.map((value) => value.address) }
          : null;
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
      if (!validatorAddressRequired && !subnetIdRequired) return {};

      const validator = EArray.head(validators).pipe(Option.getOrNull);
      return validator
        ? {
            validatorAddress: validator.address,
            subnetId: subnetIdRequired ? validator.subnet?.id : undefined,
          }
        : null;
    })();
    if (!validatorArguments) return null;

    return {
      selectedValidators,
      selectedStake,
      gasFeeToken: selectedStake.mechanics.gasFeeToken,
      dto: {
        address,
        yieldId: selectedStake.id,
        arguments: {
          amount: stakeAmount.toString(10),
          ...(selectedToken.address
            ? { inputToken: selectedToken.address }
            : {}),
          ...(isLedgerLive ? { ledgerWalletApiCompatible: true } : {}),
          ...(tronResource ? { tronResource } : {}),
          ...(useMaxAmount ? { useMaxAmount: true } : {}),
          ...(selectedProviderYieldId
            ? { providerId: selectedProviderYieldId }
            : {}),
          ...validatorArguments,
          ...(additionalAddresses ?? {}),
        },
      },
    };
  }, [
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
  ]);
};
