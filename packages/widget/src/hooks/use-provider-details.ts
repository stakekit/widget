import {
  getYieldProviderYieldIds,
  isYieldWithProviderOptions,
} from "@sk-widget/domain/types";
import { useMultiYields } from "@sk-widget/hooks/api/use-multi-yields";
import type { RewardTypes, ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import type { GetMaybeJust } from "../types";
import { getRewardRateFormatted } from "../utils/formatters";

type Res = Maybe<{
  logo: string | undefined;
  name: string;
  rewardRateFormatted: string;
  rewardRate: number | undefined;
  rewardType: RewardTypes;
  address?: string;
  stakedBalance?: ValidatorDto["stakedBalance"];
  votingPower?: ValidatorDto["votingPower"];
  commission?: ValidatorDto["commission"];
  website?: ValidatorDto["website"];
  status?: ValidatorDto["status"];
  preferred?: ValidatorDto["preferred"];
}>;

const getProviderDetails = ({
  integrationData,
  validatorAddress,
  yields,
  selectedProviderYieldId,
}: {
  integrationData: Maybe<YieldDto>;
  validatorAddress: Maybe<string>;
  yields: Maybe<YieldDto[]>;
  selectedProviderYieldId: Maybe<string>;
}): Res => {
  const def = integrationData.chain((val) =>
    Maybe.fromNullable(val.metadata.provider)
      .map<GetMaybeJust<Res>>((v) => ({
        logo: v.logoURI,
        name: v.name,
        rewardRateFormatted: getRewardRateFormatted({
          rewardRate: val.rewardRate,
          rewardType: val.rewardType,
        }),
        rewardRate: val.rewardRate,
        rewardType: val.rewardType,
        website: v.externalLink,
        address: validatorAddress.extract(),
      }))
      .altLazy(() =>
        Maybe.of({
          logo: val.metadata.logoURI,
          name: val.metadata.name,
          rewardRateFormatted: getRewardRateFormatted({
            rewardRate: val.rewardRate,
            rewardType: val.rewardType,
          }),
          rewardRate: val.rewardRate,
          rewardType: val.rewardType,
          address: validatorAddress.extract(),
        })
      )
  );

  return integrationData.chain((val) =>
    validatorAddress
      .chain<GetMaybeJust<Res>>((addr) =>
        List.find(
          (v) => v.address === addr || v.providerId === addr,
          val.validators
        ).map((v) => {
          const { rewardRate, rewardType } = Maybe.fromRecord({
            _: Maybe.fromFalsy(isYieldWithProviderOptions(val)),
            selectedProviderYieldId,
          })
            .chain(({ selectedProviderYieldId }) =>
              yields.chain(List.find((v) => v.id === selectedProviderYieldId))
            )
            .map((v) => v.rewardRate + v.rewardRate)
            .map<{ rewardRate: number | undefined; rewardType: RewardTypes }>(
              (res) => ({ rewardRate: res, rewardType: val.rewardType })
            )
            .orDefault({ rewardRate: v.apr, rewardType: val.rewardType });

          return {
            logo: v.image,
            name: v.name ?? v.address,
            rewardRateFormatted: getRewardRateFormatted({
              rewardRate,
              rewardType,
            }),
            rewardRate,
            rewardType: val.rewardType,
            address: v.address,
            stakedBalance: v.stakedBalance,
            votingPower: v.votingPower,
            commission: v.commission,
            status: v.status,
            website: v.website,
            preferred: v.preferred,
          };
        })
      )
      .altLazy(() => def)
  );
};

export const useProvidersDetails = ({
  integrationData,
  validatorsAddresses,
  selectedProviderYieldId,
}: {
  integrationData: Maybe<YieldDto>;
  validatorsAddresses: Maybe<string[] | Map<string, ValidatorDto>>;
  selectedProviderYieldId: Maybe<string>;
}) => {
  const yields = useMultiYields(
    integrationData.map(getYieldProviderYieldIds).orDefault([])
  );

  return useMemo<Maybe<GetMaybeJust<ReturnType<typeof getProviderDetails>>[]>>(
    () =>
      validatorsAddresses.chain((val) =>
        Maybe.sequence(
          (val instanceof Map
            ? [...val.values()].map((v) => v.address)
            : val
          ).map((v) =>
            getProviderDetails({
              integrationData,
              validatorAddress: Maybe.of(v),
              yields: Maybe.fromNullable(yields.data),
              selectedProviderYieldId,
            })
          )
        ).chain((val) =>
          val.length
            ? Maybe.of(val)
            : getProviderDetails({
                integrationData,
                validatorAddress: Maybe.empty(),
                yields: Maybe.fromNullable(yields.data),
                selectedProviderYieldId,
              }).map((v) => [v])
        )
      ),
    [integrationData, validatorsAddresses, yields.data, selectedProviderYieldId]
  );
};
