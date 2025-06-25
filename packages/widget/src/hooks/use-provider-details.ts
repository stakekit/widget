import { isEigenRestaking } from "@sk-widget/domain/types/yields";
import { useP2PYield } from "@sk-widget/hooks/api/use-p2p-yield";
import type { GetMaybeJust } from "@sk-widget/types/utils";
import type { RewardTypes, ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
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

export const getProviderDetails = ({
  integrationData,
  validatorAddress,
  p2pYield,
}: {
  integrationData: Maybe<YieldDto>;
  validatorAddress: Maybe<string>;
  p2pYield: Maybe<YieldDto>;
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
          const { rewardRate, rewardType } = Maybe.fromFalsy(
            isEigenRestaking(val)
          )
            .chain(() => p2pYield.map((v) => v.rewardRate + v.rewardRate))
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
}: {
  integrationData: Maybe<YieldDto>;
  validatorsAddresses: Maybe<string[] | Map<string, ValidatorDto>>;
}) => {
  const p2pYield = useP2PYield(integrationData.map(isEigenRestaking).isJust());

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
              p2pYield: Maybe.fromNullable(p2pYield.data),
            })
          )
        ).chain((val) =>
          val.length
            ? Maybe.of(val)
            : getProviderDetails({
                integrationData,
                validatorAddress: Maybe.empty(),
                p2pYield: Maybe.fromNullable(p2pYield.data),
              }).map((v) => [v])
        )
      ),
    [integrationData, validatorsAddresses, p2pYield.data]
  );
};
