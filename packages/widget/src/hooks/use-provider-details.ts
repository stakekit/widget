import { useAtomValue } from "@effect/atom-react";
import { Array as EArray, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../domain/schema/earn-models";
import type { YieldId } from "../domain/schema/identifiers";
import type { ValidatorKey } from "../domain/types/validators";
import {
  getYieldProviderYieldIds,
  isYieldWithProviderOptions,
} from "../domain/types/yields";
import { getRewardRateFormatted } from "../utils/formatters";
import { MultiYieldsKey, visibleMultiYieldsAtom } from "./api/yield-atoms";

export type ProviderDetails = {
  readonly address?: EarnValidator["address"];
  readonly commission?: EarnValidator["commission"];
  readonly logo: string | undefined;
  readonly name: string;
  readonly preferred?: EarnValidator["preferred"];
  readonly rewardRate: number | undefined;
  readonly rewardRateFormatted: string;
  readonly rewardType: string | undefined;
  readonly stakedBalance?: EarnValidator["tvl"];
  readonly status?: EarnValidator["status"];
  readonly votingPower?: EarnValidator["votingPower"];
  readonly website?: EarnValidator["website"];
};

export const getProviderDetails = ({
  integrationData,
  validator,
  yields,
  selectedProviderYieldId,
}: {
  readonly integrationData: EarnYieldWithProvider | null;
  readonly selectedProviderYieldId: YieldId | null;
  readonly validator: EarnValidator | null;
  readonly yields: ReadonlyArray<EarnYieldWithProvider> | null;
}): ProviderDetails | null => {
  if (!integrationData) return null;

  if (validator) {
    const selectedProviderYield =
      isYieldWithProviderOptions(integrationData) &&
      selectedProviderYieldId &&
      yields
        ? EArray.findFirst(
            yields,
            (yieldDto) => yieldDto.id === selectedProviderYieldId
          ).pipe(Option.getOrNull)
        : null;
    const rewardRate =
      selectedProviderYield?.rewardRate.total ?? validator.rewardRate?.total;
    const rewardType = integrationData.rewardRate?.rateType?.toLowerCase();

    return {
      address: validator.address,
      commission: validator.commission,
      logo: validator.logoURI,
      name: validator.name ?? validator.address,
      preferred: validator.preferred,
      rewardRate,
      rewardRateFormatted: getRewardRateFormatted({ rewardRate }),
      rewardType,
      stakedBalance: validator.tvl,
      status: validator.status,
      votingPower: validator.votingPower,
      website: validator.website,
    };
  }

  const rewardRate = integrationData.rewardRate.total;
  const rewardType = integrationData.rewardRate?.rateType?.toLowerCase();
  const provider = integrationData.provider;

  return {
    address: undefined,
    logo: provider?.logoURI ?? integrationData.metadata.logoURI,
    name: provider?.name ?? integrationData.metadata.name,
    rewardRate,
    rewardRateFormatted: getRewardRateFormatted({ rewardRate }),
    rewardType,
    website: provider?.website,
  };
};

export const useProvidersDetails = ({
  integrationData,
  validators,
  selectedProviderYieldId,
}: {
  readonly integrationData: EarnYieldWithProvider | null;
  readonly selectedProviderYieldId: YieldId | null;
  readonly validators:
    | Map<ValidatorKey, EarnValidator>
    | ReadonlyArray<EarnValidator>
    | null;
}): ProviderDetails[] | null => {
  const yieldIds = integrationData
    ? getYieldProviderYieldIds(integrationData)
    : [];
  const yields = AsyncResult.getOrElse(
    useAtomValue(
      visibleMultiYieldsAtom(
        new MultiYieldsKey({
          enabled: yieldIds.length > 0,
          yieldIds,
        })
      )
    ),
    () => null
  );

  if (!validators) return null;

  const values =
    validators instanceof Map ? [...validators.values()] : validators;
  const details = values.map((validator) =>
    getProviderDetails({
      integrationData,
      validator,
      yields,
      selectedProviderYieldId,
    })
  );

  if (details.some((detail) => detail === null)) return null;
  if (details.length > 0) return details as ProviderDetails[];

  const fallback = getProviderDetails({
    integrationData,
    validator: null,
    yields,
    selectedProviderYieldId,
  });

  return fallback ? [fallback] : null;
};
