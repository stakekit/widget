import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import type { RewardTypes } from "../domain/types/reward-rate";
import type { ValidatorDto } from "../domain/types/validators";
import {
  getYieldProviderDetails,
  getYieldProviderYieldIds,
  getYieldRewardType,
  isYieldWithProviderOptions,
  type Yield,
} from "../domain/types/yields";
import type { GetMaybeJust } from "../types/utils";
import { getRewardRateFormatted } from "../utils/formatters";
import { useMultiYields } from "./api/use-multi-yields";

type Res = Maybe<{
  logo: string | undefined;
  name: string;
  rewardRateFormatted: string;
  rewardRate: number | undefined;
  rewardType: RewardTypes;
  address?: string;
  stakedBalance?: ValidatorDto["tvl"];
  votingPower?: ValidatorDto["votingPower"];
  commission?: ValidatorDto["commission"];
  website?: ValidatorDto["website"];
  status?: ValidatorDto["status"];
  preferred?: ValidatorDto["preferred"];
}>;

export const getProviderDetails = ({
  integrationData,
  validator,
  yields,
  selectedProviderYieldId,
}: {
  integrationData: Maybe<Yield>;
  validator: Maybe<ValidatorDto>;
  yields: Maybe<ReadonlyArray<Yield>>;
  selectedProviderYieldId: Maybe<string>;
}): Res => {
  const def = integrationData.chain((val) => {
    const rewardRate = val.rewardRate.total;
    const rewardType = getYieldRewardType(val);
    const provider = getYieldProviderDetails(val);

    const rewardRateFormatted = getRewardRateFormatted({
      rewardRate,
      rewardType,
    });

    return Maybe.fromNullable(provider)
      .map<GetMaybeJust<Res>>((v) => ({
        logo: v.logoURI,
        name: v.name,
        rewardRateFormatted,
        rewardRate,
        rewardType,
        website: v.externalLink,
        address: validator.map((v) => v.address).extract(),
      }))
      .altLazy(() =>
        Maybe.of({
          logo: val.metadata.logoURI,
          name: val.metadata.name,
          rewardRateFormatted,
          rewardRate,
          rewardType,
          address: validator.map((v) => v.address).extract(),
        })
      );
  });

  return integrationData.chain((yieldDto) =>
    validator
      .map<GetMaybeJust<Res>>((validator) => {
        const { rewardRate, rewardType } = Maybe.fromRecord({
          _: Maybe.fromFalsy(isYieldWithProviderOptions(yieldDto)),
          selectedProviderYieldId,
        })
          .chain(({ selectedProviderYieldId }) =>
            yields.chain((list) =>
              List.find((v) => v.id === selectedProviderYieldId, [...list])
            )
          )
          .map((v) => v.rewardRate.total)
          .map<{ rewardRate: number | undefined; rewardType: RewardTypes }>(
            (res) => ({
              rewardRate: res,
              rewardType: getYieldRewardType(yieldDto),
            })
          )
          .orDefault({
            rewardRate: validator.rewardRate?.total,
            rewardType: getYieldRewardType(yieldDto),
          });

        return {
          logo: validator.logoURI,
          name: validator.name ?? validator.address,
          rewardRateFormatted: getRewardRateFormatted({
            rewardRate,
            rewardType,
          }),
          rewardRate,
          rewardType: getYieldRewardType(yieldDto),
          address: validator.address,
          stakedBalance: validator.tvl,
          votingPower: validator.votingPower,
          commission: validator.commission,
          status: validator.status,
          website: validator.website,
          preferred: validator.preferred,
        };
      })
      .altLazy(() => def)
  );
};

export const useProvidersDetails = ({
  integrationData,
  validators,
  selectedProviderYieldId,
}: {
  integrationData: Maybe<Yield>;
  validators: Maybe<ReadonlyArray<ValidatorDto> | Map<string, ValidatorDto>>;
  selectedProviderYieldId: Maybe<string>;
}) => {
  const yields = useMultiYields(
    integrationData.map(getYieldProviderYieldIds).orDefault([])
  );

  return useMemo<Maybe<GetMaybeJust<ReturnType<typeof getProviderDetails>>[]>>(
    () =>
      validators.chain((val) =>
        Maybe.sequence(
          (val instanceof Map ? [...val.values()] : val).map((v) =>
            getProviderDetails({
              integrationData,
              validator: Maybe.of(v),
              yields: Maybe.fromNullable(yields.data),
              selectedProviderYieldId,
            })
          )
        ).chain((val) =>
          val.length
            ? Maybe.of(val)
            : getProviderDetails({
                integrationData,
                validator: Maybe.empty(),
                yields: Maybe.fromNullable(yields.data),
                selectedProviderYieldId,
              }).map((v) => [v])
        )
      ),
    [integrationData, validators, yields.data, selectedProviderYieldId]
  );
};
