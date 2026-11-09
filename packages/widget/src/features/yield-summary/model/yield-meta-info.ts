import type { DateTime } from "effect";
import type { TFunction } from "i18next";
import { isConfidentialYield } from "../../../domain/earn/confidential";
import { getConfidentialCampaignUrl } from "../../../domain/earn/confidential-campaign";
import type { ValidatorInput } from "../../../domain/earn/validator";
import {
  getExtendedYieldType,
  getYieldCooldownPeriod,
  getYieldLockupPeriod,
  getYieldRewardTokens,
  getYieldWarmupPeriod,
  hasYieldFeeConfigurationEnabled,
  isEthenaUsdeStaking,
} from "../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import type { Token } from "../../../domain/token/token";
import { formatNextBatchTiming, getNextBatchCopyOptions } from "./next-batch";

/** A selected validator, named by its name or else its address. */
export type YieldMetaValidator = {
  [Key in keyof Pick<ValidatorInput, "name" | "address">]?: ValidatorInput[Key];
};

/** Copy whose `link0` slot links to `href`, e.g. a campaign's "Learn more". */
export type YieldMetaLinkedCopy = Readonly<{
  readonly i18nKey:
    | "details.campaign"
    | "details.campaign_susd"
    | "details.campaign_susd_position_locked"
    | "details.confidential_campaign";
  readonly href: string;
}>;

/** What entering and exiting a yield means for its holder, as notes. */
export type YieldMetaInfo = Readonly<{
  readonly campaign: YieldMetaLinkedCopy | null;
  readonly description: string | null;
  readonly earnPeriod: string | null;
  readonly earnRewards: string | null;
  readonly extra: string | null;
  readonly lockupPeriod: string | null;
  readonly positionLocked: YieldMetaLinkedCopy | null;
  readonly withdrawnNotAvailable: string | null;
  readonly withdrawnTime: string | null;
}>;

export const emptyYieldMetaInfo: YieldMetaInfo = {
  campaign: null,
  description: null,
  earnPeriod: null,
  earnRewards: null,
  extra: null,
  lockupPeriod: null,
  positionLocked: null,
  withdrawnNotAvailable: null,
  withdrawnTime: null,
};

const susdCampaignUrl =
  "https://blog.synthetix.io/susd-staks-5-million-snx-rewards/";
const snxCampaignUrl = "https://420.synthetix.io/?collateral=SNX";

type VaultDescriptionContext =
  | "confidential"
  | "with_fee_configuration"
  | "ethena_usde";

/** The yield's facts every type's notes read. */
type MetaFacts = Readonly<{
  readonly confidential: boolean;
  readonly cooldownDays: number;
  readonly hasFeeConfiguration: boolean;
  /** Without one the copy drops its "you'll receive" clause. */
  readonly hasReceivedToken: boolean;
  readonly manualClaiming: boolean;
  readonly now: DateTime.Utc | null;
  readonly providerName: string;
  readonly rewardSchedule: EarnYieldWithProvider["mechanics"]["rewardSchedule"];
  readonly rewardTokens: string;
  readonly stakeToken: string;
  readonly t: TFunction;
  readonly warmupDays: number;
  readonly yieldDto: EarnYieldWithProvider;
}>;

type TypeNotes = Pick<
  YieldMetaInfo,
  | "description"
  | "earnPeriod"
  | "earnRewards"
  | "withdrawnNotAvailable"
  | "withdrawnTime"
>;

const getProviderName = ({
  t,
  validators,
  yieldDto,
}: {
  readonly t: TFunction;
  readonly validators: ReadonlyArray<YieldMetaValidator>;
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const validator =
    validators.find((v) => !!(v.name ?? v.address)) ?? validators[0];
  if (validator) {
    return t("details.selected_validators", {
      providerName: validator.name ?? validator.address,
      count: validators.length - 1,
    });
  }
  return yieldDto.provider ? yieldDto.provider.name : yieldDto.metadata.name;
};

const getCampaign = (
  yieldDto: EarnYieldWithProvider
): YieldMetaLinkedCopy | null => {
  const confidentialCampaignUrl = getConfidentialCampaignUrl(yieldDto);
  if (confidentialCampaignUrl) {
    return {
      i18nKey: "details.confidential_campaign",
      href: confidentialCampaignUrl,
    };
  }
  return yieldDto.mechanics.rewardSchedule === "campaign"
    ? { i18nKey: "details.campaign", href: snxCampaignUrl }
    : null;
};

const getStakingNotes = ({
  cooldownDays,
  manualClaiming,
  rewardSchedule,
  t,
  warmupDays,
}: MetaFacts): TypeNotes => ({
  description: null,
  earnPeriod:
    warmupDays > 0
      ? t("details.native_staking.earn_after_warmup", { count: warmupDays })
      : null,
  earnRewards: manualClaiming
    ? t("details.native_staking.earn_rewards_manual", { rewardSchedule })
    : t("details.native_staking.earn_rewards_auto", { rewardSchedule }),
  withdrawnTime:
    cooldownDays > 0
      ? t("details.native_staking.unstake_time", { count: cooldownDays })
      : t("details.native_staking.unstake_time_immediately"),
  withdrawnNotAvailable: null,
});

const getLendDescription = ({
  hasFeeConfiguration,
  hasReceivedToken,
  providerName,
  rewardTokens,
  stakeToken,
  t,
}: MetaFacts) => {
  if (providerName.includes("Compound")) {
    return hasReceivedToken
      ? t("details.lend.description_compound", { stakeToken, rewardTokens })
      : t("details.lend.description_compound_without_receipt", { stakeToken });
  }
  const feeContext = hasFeeConfiguration
    ? ({ context: "with_fee_configuration" } as const)
    : {};
  return hasReceivedToken
    ? t("details.lend.description", {
        stakeToken,
        rewardTokens,
        providerName,
        ...feeContext,
      })
    : t("details.lend.description_without_receipt", {
        stakeToken,
        providerName,
        ...feeContext,
      });
};

const getLendingNotes = (facts: MetaFacts): TypeNotes => {
  const { cooldownDays, manualClaiming, rewardSchedule, t, warmupDays } = facts;
  return {
    description: getLendDescription(facts),
    earnPeriod:
      warmupDays > 0
        ? t("details.lend.earn_after_warmup", { count: warmupDays })
        : null,
    earnRewards: manualClaiming
      ? t("details.lend.earn_interest_manual", { rewardSchedule })
      : t("details.lend.earn_interest_auto", { rewardSchedule }),
    withdrawnTime:
      cooldownDays > 0
        ? t("details.lend.withdrawn_time", { count: cooldownDays })
        : t("details.lend.withdrawn_time_immediately"),
    withdrawnNotAvailable: null,
  };
};

const getVaultDescriptionContext = ({
  confidential,
  hasFeeConfiguration,
  yieldDto,
}: MetaFacts): VaultDescriptionContext | undefined => {
  if (confidential) return "confidential";
  if (hasFeeConfiguration) return "with_fee_configuration";
  if (isEthenaUsdeStaking(yieldDto.id)) return "ethena_usde";
  return undefined;
};

const getVaultDescription = (facts: MetaFacts) => {
  const { hasReceivedToken, rewardTokens, stakeToken, t } = facts;
  const context = getVaultDescriptionContext(facts);
  if (hasReceivedToken) {
    return t("details.vault.description", {
      stakeToken,
      depositToken: rewardTokens,
      ...(context === undefined ? {} : { context }),
    });
  }
  // Ethena's description is only its receive clause.
  if (context === undefined || context === "ethena_usde") {
    return t("details.vault.description_without_receipt", { stakeToken });
  }
  return t("details.vault.description_without_receipt", {
    stakeToken,
    context,
  });
};

/** i18n options naming when the yield's next `side` batch runs. */
const nextBatchCopyOptions = (
  { now, t, yieldDto }: MetaFacts,
  side: "subscription" | "redemption"
) => getNextBatchCopyOptions(formatNextBatchTiming({ now, side, t, yieldDto }));

// Confidential vaults settle deposits and private withdrawals in batches.
const getVaultEarnPeriod = (facts: MetaFacts) => {
  const { confidential, t, warmupDays } = facts;
  if (confidential) {
    return t(
      "details.vault.earn_after_batch",
      nextBatchCopyOptions(facts, "subscription")
    );
  }
  return warmupDays > 0
    ? t("details.vault.earn_after_warmup", { count: warmupDays })
    : null;
};

const getVaultWithdrawnTime = (facts: MetaFacts) => {
  const { confidential, cooldownDays, t } = facts;
  if (confidential) {
    return t(
      "details.vault.withdrawn_time_confidential",
      nextBatchCopyOptions(facts, "redemption")
    );
  }
  return cooldownDays > 0
    ? t("details.vault.withdrawn_time", { count: cooldownDays })
    : t("details.vault.withdrawn_time_immediately");
};

const getVaultNotes = (facts: MetaFacts): TypeNotes => {
  const { manualClaiming, rewardSchedule, t } = facts;
  return {
    description: getVaultDescription(facts),
    earnPeriod: getVaultEarnPeriod(facts),
    earnRewards: manualClaiming
      ? t("details.vault.earn_yield_manual", { rewardSchedule })
      : t("details.vault.earn_yield_auto", { rewardSchedule }),
    withdrawnTime: getVaultWithdrawnTime(facts),
    withdrawnNotAvailable: null,
  };
};

const getRestakeWithdrawnTime = ({ cooldownDays, t, yieldDto }: MetaFacts) => {
  if (!yieldDto.status.exit) return null;
  return cooldownDays > 0
    ? t("details.restake.unstake_time", { count: cooldownDays })
    : t("details.restake.unstake_time_immediately");
};

const getRestakeWithdrawnNotAvailable = ({
  hasReceivedToken,
  rewardTokens,
  t,
  yieldDto,
}: MetaFacts) => {
  if (yieldDto.status.exit) return null;
  return hasReceivedToken
    ? t("details.restake.withdrawn_not_available", { rewardTokens })
    : t("details.restake.withdrawn_not_available_without_receipt");
};

const getRestakingNotes = (facts: MetaFacts): TypeNotes => {
  const {
    hasReceivedToken,
    manualClaiming,
    rewardSchedule,
    rewardTokens,
    stakeToken,
    t,
    warmupDays,
  } = facts;
  return {
    description: hasReceivedToken
      ? t("details.restake.description", { stakeToken, rewardTokens })
      : t("details.restake.description_without_receipt", { stakeToken }),
    earnPeriod:
      warmupDays > 0
        ? t("details.restake.earn_after_warmup", { count: warmupDays })
        : null,
    earnRewards: manualClaiming
      ? t("details.restake.earn_rewards_manual", { rewardSchedule })
      : t("details.restake.earn_rewards_auto", { rewardSchedule }),
    withdrawnTime: getRestakeWithdrawnTime(facts),
    withdrawnNotAvailable: getRestakeWithdrawnNotAvailable(facts),
  };
};

const getTypeNotes = (facts: MetaFacts): TypeNotes | null => {
  switch (getExtendedYieldType(facts.yieldDto)) {
    case "staking":
    case "liquid_staking":
    case "native_staking":
    case "pooled_staking":
      return getStakingNotes(facts);
    case "lending":
      return getLendingNotes(facts);
    case "vault":
    case "fixed_yield":
    case "real_world_asset":
    case "concentrated_liquidity_pool":
    case "liquidity_pool":
      return getVaultNotes(facts);
    case "restaking":
      return getRestakingNotes(facts);
    default:
      return null;
  }
};

/**
 * The notes on what staking `token` into the yield means: how it is
 * described, when it earns, how rewards arrive, and when it can be withdrawn.
 * Campaign and position-locked notes are linked copy for the view to render.
 * With `now`, a confidential vault's batch notes name the next batch's timing.
 */
export const getYieldMetaInfo = ({
  now,
  t,
  token,
  validators,
  yieldDto,
}: {
  readonly now: DateTime.Utc | null;
  readonly t: TFunction;
  readonly token: Token;
  readonly validators: ReadonlyArray<YieldMetaValidator>;
  readonly yieldDto: EarnYieldWithProvider;
}): YieldMetaInfo => {
  const rewardSchedule = yieldDto.mechanics.rewardSchedule;
  const stakeToken = token.symbol;

  if (rewardSchedule === "campaign" && stakeToken.toUpperCase() === "SUSD") {
    return {
      ...emptyYieldMetaInfo,
      description: t("details.campaign_susd_description"),
      extra: t("details.campaign_susd_extra"),
      positionLocked: {
        i18nKey: "details.campaign_susd_position_locked",
        href: susdCampaignUrl,
      },
      campaign: { i18nKey: "details.campaign_susd", href: susdCampaignUrl },
    };
  }

  const rewardTokens = getYieldRewardTokens(yieldDto)
    .filter((rewardToken) => !rewardToken.isPoints)
    .map((rewardToken) => rewardToken.symbol)
    .join(", ");
  const notes = getTypeNotes({
    confidential: isConfidentialYield(yieldDto),
    cooldownDays: getYieldCooldownPeriod(yieldDto)?.days ?? 0,
    hasFeeConfiguration: hasYieldFeeConfigurationEnabled(yieldDto),
    hasReceivedToken: rewardTokens.length > 0,
    manualClaiming: yieldDto.mechanics.rewardClaiming === "manual",
    now,
    providerName: getProviderName({ t, validators, yieldDto }),
    rewardSchedule,
    rewardTokens,
    stakeToken,
    t,
    warmupDays: getYieldWarmupPeriod(yieldDto)?.days ?? 0,
    yieldDto,
  });
  if (!notes) return emptyYieldMetaInfo;

  const lockupDays = getYieldLockupPeriod(yieldDto)?.days;
  return {
    ...notes,
    campaign: getCampaign(yieldDto),
    extra: yieldDto.token.network === "tezos" ? t("details.extra_tezos") : null,
    lockupPeriod: lockupDays
      ? t("details.lockup_period", { count: lockupDays })
      : null,
    positionLocked: null,
  };
};
