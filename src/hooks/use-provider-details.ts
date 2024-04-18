import type { RewardTypes, ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import type { GetMaybeJust } from "../types";
import { getRewardRateFormatted } from "../utils/formatters";

type Res = Maybe<{
  logo: string;
  name: string;
  rewardRateFormatted: string;
  rewardRate: number;
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
}: {
  integrationData: Maybe<YieldDto>;
  validatorAddress: Maybe<string>;
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
        })
      )
  );

  return integrationData.chain((val) =>
    validatorAddress
      .chain<GetMaybeJust<Res>>((addr) =>
        List.find((v) => v.address === addr, val.validators).map((v) => ({
          logo: v.image,
          name: v.name ?? v.address,
          rewardRateFormatted: getRewardRateFormatted({
            rewardRate: v.apr,
            rewardType: val.rewardType,
          }),
          rewardRate: v.apr,
          rewardType: val.rewardType,
          address: v.address,
          stakedBalance: v.stakedBalance,
          votingPower: v.votingPower,
          commission: v.commission,
          status: v.status,
          website: v.website,
          preferred: v.preferred,
        }))
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
}) =>
  useMemo<Maybe<GetMaybeJust<ReturnType<typeof getProviderDetails>>[]>>(
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
            })
          )
        ).chain((val) =>
          !!val.length
            ? Maybe.of(val)
            : getProviderDetails({
                integrationData,
                validatorAddress: Maybe.empty(),
              }).map((v) => [v])
        )
      ),
    [integrationData, validatorsAddresses]
  );
