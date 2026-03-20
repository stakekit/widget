import type { RewardTypes, ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import {
  getYieldProviderYieldIds,
  isYieldWithProviderOptions,
} from "../domain/types/yields";
import type { GetMaybeJust } from "../types/utils";
import { getRewardRateFormatted } from "../utils/formatters";
import { useMultiYields } from "./api/use-multi-yields";
import { useYieldValidators } from "./api/use-yield-validators";

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

export const getProviderDetails = ({
  integrationData,
  validatorAddress,
  yields,
  selectedProviderYieldId,
  validatorsData,
}: {
  integrationData: Maybe<YieldDto>;
  validatorAddress: Maybe<string>;
  yields: Maybe<YieldDto[]>;
  selectedProviderYieldId: Maybe<string>;
  validatorsData?: ValidatorDto[];
}): Res => {
  const def = integrationData.chain((val) => {
    const rewardRate = val.rewardRate;

    const rewardRateFormatted = getRewardRateFormatted({
      rewardRate,
      rewardType: val.rewardType,
    });

    return Maybe.fromNullable(val.metadata.provider)
      .map<GetMaybeJust<Res>>((v) => ({
        logo: v.logoURI,
        name: v.name,
        rewardRateFormatted,
        rewardRate,
        rewardType: val.rewardType,
        website: v.externalLink,
        address: validatorAddress.extract(),
      }))
      .altLazy(() =>
        Maybe.of({
          logo: val.metadata.logoURI,
          name: val.metadata.name,
          rewardRateFormatted,
          rewardRate,
          rewardType: val.rewardType,
          address: validatorAddress.extract(),
        })
      );
  });

  return integrationData.chain((yieldDto) =>
    validatorAddress
      .chain<GetMaybeJust<Res>>((addr) =>
        List.find(
          (v) => v.address === addr || v.providerId === addr,
          validatorsData ?? []
        ).map((validator) => {
          const { rewardRate, rewardType } = Maybe.fromRecord({
            _: Maybe.fromFalsy(isYieldWithProviderOptions(yieldDto)),
            selectedProviderYieldId,
          })
            .chain(({ selectedProviderYieldId }) =>
              yields.chain(List.find((v) => v.id === selectedProviderYieldId))
            )
            .map((v) => v.rewardRate + v.rewardRate)
            .map<{ rewardRate: number | undefined; rewardType: RewardTypes }>(
              (res) => ({ rewardRate: res, rewardType: yieldDto.rewardType })
            )
            .orDefault({
              rewardRate: validator.apr,
              rewardType: yieldDto.rewardType,
            });

          return {
            logo: validator.image,
            name: validator.name ?? validator.address,
            rewardRateFormatted: getRewardRateFormatted({
              rewardRate,
              rewardType,
            }),
            rewardRate,
            rewardType: yieldDto.rewardType,
            address: validator.address,
            stakedBalance: validator.stakedBalance,
            votingPower: validator.votingPower,
            commission: validator.commission,
            status: validator.status,
            website: validator.website,
            preferred: validator.preferred,
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
  validatorsData,
}: {
  integrationData: Maybe<YieldDto>;
  validatorsAddresses: Maybe<string[] | Map<string, ValidatorDto>>;
  selectedProviderYieldId: Maybe<string>;
  validatorsData?: Maybe<ValidatorDto[]>;
}) => {
  const yields = useMultiYields(
    integrationData.map(getYieldProviderYieldIds).orDefault([])
  );

  const shouldFetchValidators = validatorsAddresses
    .filter((val): val is string[] => !(val instanceof Map))
    .map((val) => val.length > 0)
    .chain((val) =>
      validatorsData?.isJust() ? Maybe.of(false) : Maybe.of(val)
    )
    .orDefault(false);

  const yieldValidators = useYieldValidators({
    enabled: shouldFetchValidators,
    yieldId:
      integrationData.map((val) => val.id).extractNullable() ?? undefined,
    network:
      integrationData.map((val) => val.token.network).extractNullable() ??
      undefined,
  });

  const resolvedValidatorsData = useMemo(
    () =>
      validatorsData?.altLazy(() =>
        validatorsAddresses.chain((val) =>
          val instanceof Map
            ? Maybe.of([...val.values()])
            : Maybe.fromNullable(yieldValidators.data)
        )
      ) ??
      validatorsAddresses.chain((val) =>
        val instanceof Map
          ? Maybe.of([...val.values()])
          : Maybe.fromNullable(yieldValidators.data)
      ),
    [validatorsAddresses, validatorsData, yieldValidators.data]
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
              validatorsData:
                resolvedValidatorsData.extractNullable() ?? undefined,
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
    [
      integrationData,
      validatorsAddresses,
      yields.data,
      selectedProviderYieldId,
      resolvedValidatorsData,
    ]
  );
};
