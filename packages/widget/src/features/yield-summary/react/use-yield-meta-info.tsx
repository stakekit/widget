import { useAtomValue } from "@effect/atom-react";
import { Array as EArray, Option } from "effect";
import type { ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";
import {
  getConfidentialCampaignUrl,
  isConfidentialYield,
} from "../../../domain/earn/confidential";
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
import type { Token } from "../../../domain/token/token";
import { presentationClockAtom } from "../../../shared/effect/presentation-clock";
import { ExternalLink } from "../../../ui/index";
import {
  formatNextBatchTiming,
  getNextBatchCopyOptions,
} from "../model/next-batch";

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
  const presentationTime = useAtomValue(presentationClockAtom);

  const validatorsFormatted =
    EArray.findFirst(validators, (v) => !!(v.name ?? v.address)).pipe(
      Option.getOrUndefined
    ) ?? EArray.head(validators).pipe(Option.getOrUndefined);

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
  // Without a received token the copy drops its "you'll receive" clause, so
  // it never interpolates an empty token name.
  const hasReceivedToken = rewardTokens.length > 0;
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
              <ExternalLink
                href="https://blog.synthetix.io/susd-staks-5-million-snx-rewards/"
                newTabLabel={t("shared.opens_in_new_tab")}
              >
                {t("shared.learn_more")}
              </ExternalLink>
            ),
          }}
        />
      ),
      campaign: (
        <Trans
          i18nKey="details.campaign_susd"
          components={{
            link0: (
              <ExternalLink
                href="https://blog.synthetix.io/susd-staks-5-million-snx-rewards/"
                newTabLabel={t("shared.opens_in_new_tab")}
              >
                {t("shared.learn_more")}
              </ExternalLink>
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

  const confidentialCampaignUrl = getConfidentialCampaignUrl(y);
  const getCampaign = () => {
    if (confidentialCampaignUrl) {
      return (
        <Trans
          i18nKey="details.confidential_campaign"
          components={{
            link0: (
              <ExternalLink
                href={confidentialCampaignUrl}
                newTabLabel={t("shared.opens_in_new_tab")}
              >
                {t("shared.learn_more")}
              </ExternalLink>
            ),
          }}
        />
      );
    }
    return rewardSchedule === "campaign" ? (
      <Trans
        i18nKey="details.campaign"
        components={{
          link0: (
            <ExternalLink
              href="https://420.synthetix.io/?collateral=SNX"
              newTabLabel={t("shared.opens_in_new_tab")}
            >
              {t("shared.learn_more")}
            </ExternalLink>
          ),
        }}
      />
    ) : null;
  };

  const def = {
    campaign: getCampaign(),
    lockupPeriod: lockupPeriodDays
      ? t("details.lockup_period", {
          count: lockupPeriodDays,
        })
      : null,
    extra: y.token.network === "tezos" ? t("details.extra_tezos") : undefined,
  };

  // Confidential vaults settle deposits and private withdrawals in batches.
  const confidential = isConfidentialYield(y);
  const getVaultDescriptionContext = () => {
    if (confidential) return "confidential" as const;
    if (haveFeeConfigurationEnabled) {
      return "with_fee_configuration" as const;
    }
    if (isEthenaUsdeStaking(y.id)) return "ethena_usde" as const;
    return undefined;
  };
  const nextBatchCopyOptions = (side: "subscription" | "redemption") =>
    getNextBatchCopyOptions(
      formatNextBatchTiming({
        now: presentationTime?.now ?? null,
        side,
        t,
        yieldDto: y,
      })
    );
  const getVaultEarnPeriod = () => {
    if (confidential) {
      return t(
        "details.vault.earn_after_batch",
        nextBatchCopyOptions("subscription")
      );
    }
    return warmupPeriodDays > 0
      ? t("details.vault.earn_after_warmup", { count: warmupPeriodDays })
      : null;
  };
  const getVaultWithdrawnTime = () => {
    if (confidential) {
      return t(
        "details.vault.withdrawn_time_confidential",
        nextBatchCopyOptions("redemption")
      );
    }
    return cooldownPeriodDays > 0
      ? t("details.vault.withdrawn_time", { count: cooldownPeriodDays })
      : t("details.vault.withdrawn_time_immediately");
  };
  const vaultDescriptionContext = getVaultDescriptionContext();
  const getVaultDescription = () => {
    if (hasReceivedToken) {
      return t("details.vault.description", {
        stakeToken,
        depositToken: rewardTokens,
        ...(vaultDescriptionContext === undefined
          ? {}
          : { context: vaultDescriptionContext }),
      });
    }
    // Ethena's description is only its receive clause.
    if (
      vaultDescriptionContext === undefined ||
      vaultDescriptionContext === "ethena_usde"
    ) {
      return t("details.vault.description_without_receipt", { stakeToken });
    }
    return t("details.vault.description_without_receipt", {
      stakeToken,
      context: vaultDescriptionContext,
    });
  };
  const lendFeeContext = haveFeeConfigurationEnabled
    ? ({ context: "with_fee_configuration" } as const)
    : {};
  const getLendDescription = () => {
    if (isCompound) {
      return hasReceivedToken
        ? t("details.lend.description_compound", { stakeToken, rewardTokens })
        : t("details.lend.description_compound_without_receipt", {
            stakeToken,
          });
    }
    return hasReceivedToken
      ? t("details.lend.description", {
          stakeToken,
          rewardTokens,
          providerName,
          ...lendFeeContext,
        })
      : t("details.lend.description_without_receipt", {
          stakeToken,
          providerName,
          ...lendFeeContext,
        });
  };
  const restakingWithdrawnTime =
    cooldownPeriodDays > 0
      ? t("details.restake.unstake_time", {
          count: cooldownPeriodDays,
        })
      : t("details.restake.unstake_time_immediately");
  const getRestakeWithdrawnNotAvailable = () => {
    if (y.status.exit) return null;
    return hasReceivedToken
      ? t("details.restake.withdrawn_not_available", { rewardTokens })
      : t("details.restake.withdrawn_not_available_without_receipt");
  };

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
        description: getLendDescription(),
        withdrawnNotAvailable: null,
        ...def,
      };

    case "vault":
    case "fixed_yield":
    case "real_world_asset":
    case "concentrated_liquidity_pool":
    case "liquidity_pool":
      return {
        description: getVaultDescription(),
        earnPeriod: getVaultEarnPeriod(),
        earnRewards:
          rewardClaiming === "manual"
            ? t("details.vault.earn_yield_manual", { rewardSchedule })
            : t("details.vault.earn_yield_auto", { rewardSchedule }),
        withdrawnTime: getVaultWithdrawnTime(),
        withdrawnNotAvailable: null,
        ...def,
      };

    case "restaking":
      return {
        description: hasReceivedToken
          ? t("details.restake.description", { stakeToken, rewardTokens })
          : t("details.restake.description_without_receipt", { stakeToken }),
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
        withdrawnNotAvailable: getRestakeWithdrawnNotAvailable(),
        ...def,
      };

    default:
      return ifNotFound;
  }
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
