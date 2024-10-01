import type { TokenDto, ValidatorDto, YieldDto } from "@stakekit/api-hooks";
import { MiscNetworks } from "@stakekit/common";
import { Maybe } from "purify-ts";
import { List } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { capitalizeFirstLowerRest } from "../utils/text";

export const useYieldMetaInfo = ({
  selectedStake,
  validators,
  tokenDto,
}: {
  selectedStake: Maybe<YieldDto>;
  validators: {
    [Key in keyof Pick<ValidatorDto, "name" | "address">]?: ValidatorDto[Key];
  }[];
  tokenDto: Maybe<TokenDto>;
}) => {
  const { t } = useTranslation();

  const validatorsFormatted = useMemo(
    () =>
      List.find((v) => !!(v.name ?? v.address), validators)
        .alt(List.head(validators))
        .map((v) =>
          t("details.selected_validators", {
            providerName: v.name ?? v.address,
            count: validators.length - 1,
          })
        ),
    [validators, t]
  );

  return useMemo(() => {
    return Maybe.fromRecord({ selectedStake, tokenDto }).mapOrDefault<
      typeof ifNotFound
    >(({ selectedStake: y, tokenDto }) => {
      const sv = validatorsFormatted.extract();

      const stakeToken = tokenDto.symbol;
      const rewardTokens =
        y.metadata.rewardTokens
          ?.filter((t) => !t.isPoints)
          .map((t) => t.symbol)
          .join(", ") ?? "";
      const providerName =
        sv ??
        (y.metadata.provider ? y.metadata.provider.name : y.metadata.name);
      const rewardSchedule = y.metadata.rewardSchedule;
      const cooldownPeriodDays = y.metadata.cooldownPeriod?.days ?? 0;
      const warmupPeriodDays = y.metadata.warmupPeriod?.days ?? 0;
      const rewardClaiming = y.metadata.rewardClaiming;

      const isCompound = providerName.includes("Compound");

      const def = {
        extra:
          y.rewardType === "variable"
            ? t("details.reward_type_varialbe", {
                symbol: capitalizeFirstLowerRest(y.token.symbol),
              })
            : y.metadata.token.network === MiscNetworks.Tezos
              ? t("details.extra_tezos")
              : undefined,
      };

      switch (y.metadata.type) {
        case "staking": {
          return {
            description: null,
            earnPeriod:
              warmupPeriodDays > 0
                ? t("details.staking.earn_after_warmup", {
                    count: warmupPeriodDays,
                  })
                : null,
            earnRewards:
              rewardClaiming === "manual"
                ? t("details.staking.earn_rewards_manual", {
                    rewardSchedule,
                  })
                : t("details.staking.earn_rewards_auto", {
                    rewardSchedule,
                  }),
            withdrawnTime:
              cooldownPeriodDays > 0
                ? t("details.staking.unstake_time_days", {
                    cooldownPeriodDays,
                  })
                : t("details.staking.unstake_time_immediately"),
            withdrawnNotAvailable: null,
            ...def,
          };
        }

        case "lending":
          return {
            earnPeriod:
              warmupPeriodDays > 0
                ? t("details.lend.earn_after_warmup", {
                    count: warmupPeriodDays,
                  })
                : null,
            earnRewards:
              rewardClaiming === "manual"
                ? t("details.lend.earn_interest_manual", { rewardSchedule })
                : t("details.lend.earn_interest_auto", { rewardSchedule }),
            withdrawnTime:
              cooldownPeriodDays > 0
                ? t("details.lend.withdrawn_time_days", {
                    cooldownPeriodDays,
                  })
                : t("details.lend.withdrawn_time_immediately"),
            description: isCompound
              ? t("details.lend.description_compound", {
                  stakeToken,
                  rewardTokens,
                })
              : t("details.lend.description", {
                  stakeToken,
                  rewardTokens,
                  providerName,
                }),
            withdrawnNotAvailable: null,
            ...def,
          };

        case "vault":
          return {
            description: t("details.vault.description", {
              stakeToken,
              depositToken: rewardTokens,
            }),
            earnPeriod:
              warmupPeriodDays > 0
                ? t("details.vault.earn_after_warmup", {
                    count: warmupPeriodDays,
                  })
                : null,
            earnRewards:
              rewardClaiming === "manual"
                ? t("details.vault.earn_yield_manual", { rewardSchedule })
                : t("details.vault.earn_yield_auto", { rewardSchedule }),
            withdrawnTime:
              cooldownPeriodDays > 0
                ? t("details.vault.withdrawn_time_days", { cooldownPeriodDays })
                : t("details.vault.withdrawn_time_immediately"),
            withdrawnNotAvailable: null,
            ...def,
          };

        case "liquid-staking":
          return {
            description: t("details.liquid_stake.description", {
              stakeToken,
              rewardTokens,
            }),
            earnPeriod:
              warmupPeriodDays > 0
                ? t("details.liquid_stake.earn_after_warmup", {
                    count: warmupPeriodDays,
                  })
                : null,
            earnRewards:
              rewardClaiming === "manual"
                ? t("details.liquid_stake.earn_rewards_manual", {
                    rewardSchedule,
                  })
                : t("details.liquid_stake.earn_rewards_auto", {
                    rewardSchedule,
                  }),
            withdrawnTime: y.status.exit
              ? cooldownPeriodDays > 0
                ? t("details.liquid_stake.unstake_time_days", {
                    cooldownPeriodDays,
                    claimDays: y.metadata.withdrawPeriod?.days ?? 0,
                    context:
                      (y.metadata.withdrawPeriod?.days ?? 0) > 0
                        ? "with_claim_days"
                        : undefined,
                  })
                : t("details.liquid_stake.unstake_time_immediately")
              : null,
            withdrawnNotAvailable: !y.status.exit
              ? t("details.liquid_stake.withdrawn_not_available", {
                  rewardTokens,
                })
              : null,
            ...def,
          };

        case "restaking":
          return {
            description: t("details.restake.description", {
              stakeToken,
              rewardTokens,
            }),
            earnPeriod:
              warmupPeriodDays > 0
                ? t("details.restake.earn_after_warmup", {
                    count: warmupPeriodDays,
                  })
                : null,
            earnRewards:
              rewardClaiming === "manual"
                ? t("details.restake.earn_rewards_manual", {
                    rewardSchedule,
                  })
                : t("details.restake.earn_rewards_auto", {
                    rewardSchedule,
                  }),
            withdrawnTime: y.status.exit
              ? cooldownPeriodDays > 0
                ? t("details.restake.unstake_time_days", {
                    cooldownPeriodDays,
                  })
                : t("details.restake.unstake_time_immediately")
              : null,
            withdrawnNotAvailable: !y.status.exit
              ? t("details.restake.withdrawn_not_available", {
                  rewardTokens,
                })
              : null,
            ...def,
          };

        default:
          return ifNotFound;
      }
    }, ifNotFound);
  }, [selectedStake, t, tokenDto, validatorsFormatted]);
};

const ifNotFound: {
  description: string | null;
  earnPeriod: string | null;
  earnRewards: string | null;
  withdrawnTime: string | null;
  withdrawnNotAvailable: string | null;
  extra?: string;
} = {
  description: null,
  earnPeriod: null,
  earnRewards: null,
  withdrawnTime: null,
  withdrawnNotAvailable: null,
};
