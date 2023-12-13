import { RewardTypes, YieldDto } from "@stakekit/api-hooks";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import { getRewardRateFormatted } from "../utils/get-reward-rate";

export const useProviderDetails = ({
  integrationData,
  validatorAddress,
}: {
  integrationData: Maybe<YieldDto>;
  validatorAddress: Maybe<"default" | (string & {})>;
}) =>
  useMemo<
    Maybe<{
      logo: string;
      name: string;
      rewardRateFormatted: string;
      rewardRate: number;
      rewardType: RewardTypes;
      address?: string;
    }>
  >(() => {
    const def = integrationData.chain((val) =>
      Maybe.fromNullable(val.metadata.provider)
        .map((v) => ({
          logo: v.logoURI,
          name: v.name,
          rewardRateFormatted: getRewardRateFormatted({
            rewardRate: val.rewardRate,
            rewardType: val.rewardType,
          }),
          rewardType: val.rewardType,
          rewardRate: val.rewardRate,
        }))
        .altLazy(() =>
          Maybe.of({
            logo: val.metadata.logoURI,
            name: val.metadata.name,
            rewardRateFormatted: getRewardRateFormatted({
              rewardRate: val.rewardRate,
              rewardType: val.rewardType,
            }),
            rewardType: val.rewardType,
            rewardRate: val.rewardRate,
          })
        )
    );

    return integrationData.chain((val) =>
      validatorAddress
        .chain((addr) => {
          if (addr === "default") {
            return def;
          }

          return List.find((v) => v.address === addr, val.validators).map(
            (v) => ({
              logo: v.image,
              name: v.name,
              rewardRateFormatted: getRewardRateFormatted({
                rewardRate: v.apr,
                rewardType: val.rewardType,
              }),
              rewardType: val.rewardType,
              rewardRate: v.apr,
              address: v.address,
            })
          );
        })
        .altLazy(() => def)
    );
  }, [integrationData, validatorAddress]);
