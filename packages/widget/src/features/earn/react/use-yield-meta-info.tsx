import { Array as EArray, Option } from "effect";
import { type ReactNode, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../domain/earn/models";
import type { ValidatorInput as ValidatorDto } from "../../../domain/earn/validator";
import {
  getExtendedYieldType,
  getYieldCooldownPeriod,
  getYieldLockupPeriod,
  getYieldRewardTokens,
  getYieldWarmupPeriod,
  hasYieldFeeConfigurationEnabled,
  isEthenaUsdeStaking,
} from "../../../domain/earn/yield";
import { MiscNetworks } from "../../../domain/network/networks";
import type { Token } from "../../../domain/token/token";
import { SKAnchor } from "../../../shared/ui/primitives/anchor";

export const useYieldMetaInfo = ({
  selectedStake,
  validators,
  tokenDto,
}: {
  selectedStake: EarnYieldWithProvider | null;
  validators: {
    [Key in keyof Pick<ValidatorDto, "name" | "address">]?: ValidatorDto[Key];
  }[];
  tokenDto: Token | null;
}) => {
  const { t } = useTranslation();

  const validatorsFormatted = useMemo(
    () =>
      EArray.findFirst(validators, (v) => !!(v.name ?? v.address)).pipe(
        Option.getOrUndefined
      ) ?? EArray.head(validators).pipe(Option.getOrUndefined),
    [validators]
  );

  return useMemo(() => {
    if (!selectedStake || !tokenDto) return ifNotFound;

    const y = selectedStake;
    const sv = validatorsFormatted
      ? t("details.selected_validators", {
          providerName: validatorsFormatted.name ?? validatorsFormatted.address,
          count: validators.length - 1,
        })
      : undefined;
    const haveFeeConfigurationEnabled = hasYieldFeeConfigurationEnabled(y);
    const stakeToken = tokenDto.symbol;
    const rewardTokens = getYieldRewardTokens(y)
      .filter((t) => !t.isPoints)
      .map((t) => t.symbol)
      .join(", ");
    const provider = y.provider;
    const providerName = sv ?? (provider ? provider.name : y.metadata.name);
    const rewardSchedule = y.mechanics.rewardSchedule;
    const cooldownPeriodDays = getYieldCooldownPeriod(y)?.days ?? 0;
    const warmupPeriodDays = getYieldWarmupPeriod(y)?.days ?? 0;
    const rewardClaiming = y.mechanics.rewardClaiming;
    const lockupPeriodDays = getYieldLockupPeriod(y)?.days;
    const yieldType = getExtendedYieldType(y);

    const isCompound = providerName.includes("Compound");

    if (rewardSchedule === "campaign" && stakeToken.toUpperCase() === "SUSD") {
      return {
        description: t("details.campaign_susd_description"),
        extra: t("details.campaign_susd_extra"),
        positionLocked: (
          <Trans
            i18nKey="details.campaign_susd_position_locked"
            components={{
              link0: (
                <SKAnchor href="https://blog.synthetix.io/susd-staks-5-million-snx-rewards/">
                  {t("shared.learn_more")}
                </SKAnchor>
              ),
            }}
          />
        ),
        campaign: (
          <Trans
            i18nKey="details.campaign_susd"
            components={{
              link0: (
                <SKAnchor href="https://blog.synthetix.io/susd-staks-5-million-snx-rewards/">
                  {t("shared.learn_more")}
                </SKAnchor>
              ),
            }}
          />
        ),
        withdrawnTime: null,
        lockupPeriod: null,
        earnPeriod: null,
        earnRewards: null,
        withdrawnNotAvailable: null,
      };
    }

    const def = {
      campaign:
        rewardSchedule === "campaign" ? (
          <Trans
            i18nKey="details.campaign"
            components={{
              link0: (
                <SKAnchor href="https://420.synthetix.io/?collateral=SNX">
                  {t("shared.learn_more")}
                </SKAnchor>
              ),
            }}
          />
        ) : null,
      lockupPeriod: lockupPeriodDays
        ? t("details.lockup_period", {
            count: lockupPeriodDays,
          })
        : null,
      extra:
        y.token.network === MiscNetworks.Tezos
          ? t("details.extra_tezos")
          : undefined,
    };

    const getVaultDescriptionContext = () => {
      if (haveFeeConfigurationEnabled) {
        return "with_fee_configuration" as const;
      }
      if (isEthenaUsdeStaking(y.id)) return "ethena_usde" as const;
      return undefined;
    };
    const vaultDescriptionContext = getVaultDescriptionContext();
    const restakingWithdrawnTime =
      cooldownPeriodDays > 0
        ? t("details.restake.unstake_time", {
            count: cooldownPeriodDays,
          })
        : t("details.restake.unstake_time_immediately");

    switch (yieldType) {
      case "staking":
      case "liquid_staking":
      case "native_staking":
      case "pooled_staking": {
        return {
          description: null,
          earnPeriod:
            warmupPeriodDays > 0
              ? t("details.native_staking.earn_after_warmup", {
                  count: warmupPeriodDays,
                })
              : null,
          earnRewards:
            rewardClaiming === "manual"
              ? t("details.native_staking.earn_rewards_manual", {
                  rewardSchedule,
                })
              : t("details.native_staking.earn_rewards_auto", {
                  rewardSchedule,
                }),
          withdrawnTime:
            cooldownPeriodDays > 0
              ? t("details.native_staking.unstake_time", {
                  count: cooldownPeriodDays,
                })
              : t("details.native_staking.unstake_time_immediately"),
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
              ? t("details.lend.withdrawn_time", {
                  count: cooldownPeriodDays,
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
                context: haveFeeConfigurationEnabled
                  ? "with_fee_configuration"
                  : undefined,
              }),
          withdrawnNotAvailable: null,
          ...def,
        };

      case "vault":
      case "fixed_yield":
      case "real_world_asset":
      case "concentrated_liquidity_pool":
      case "liquidity_pool":
        return {
          description: t("details.vault.description", {
            stakeToken,
            depositToken: rewardTokens,
            context: vaultDescriptionContext,
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
              ? t("details.vault.withdrawn_time", {
                  count: cooldownPeriodDays,
                })
              : t("details.vault.withdrawn_time_immediately"),
          withdrawnNotAvailable: null,
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
              ? t("details.restake.earn_rewards_manual", { rewardSchedule })
              : t("details.restake.earn_rewards_auto", { rewardSchedule }),
          withdrawnTime: y.status.exit ? restakingWithdrawnTime : null,
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
  }, [selectedStake, t, tokenDto, validators.length, validatorsFormatted]);
};

const ifNotFound: {
  campaign: ReactNode | null;
  description: string | null;
  earnPeriod: string | null;
  earnRewards: string | null;
  withdrawnTime: string | null;
  withdrawnNotAvailable: string | null;
  lockupPeriod: string | null;
  extra?: string;
  positionLocked?: ReactNode;
} = {
  campaign: null,
  description: null,
  earnPeriod: null,
  earnRewards: null,
  withdrawnTime: null,
  withdrawnNotAvailable: null,
  lockupPeriod: null,
};
