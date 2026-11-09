import type BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import type { getEffectiveYieldRewardRateDetails } from "../../../domain/earn/reward-rate";
import {
  getYieldActionArg,
  getYieldCategory,
  hasYieldBearingOutputToken,
  isNonZeroRewardRateYield,
} from "../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { exactDecimal } from "../../../domain/finance/exact";
import { getRewardTypeFormatted } from "../../../shared/lib/formatters";
import {
  formatCompactNumber,
  formatPercent,
  formatRatio,
  formatRoundedPercent,
  formatTokenAmount,
  formatUsd,
  unavailableFigure,
} from "../../../shared/lib/number-format";

export const formatDisplayTokenSymbol = (yieldDto: EarnYieldWithProvider) =>
  yieldDto.outputToken?.symbol ?? yieldDto.token.symbol;

/** A rate type's name, such as "APY" or "APR". */
export const formatRateTypeLabel = (rateType: string, t: TFunction): string =>
  getRewardTypeFormatted(rateType.toLowerCase()) ||
  t("dashboard.earn_details.apy");

/** The yield's own rate type, such as "APY" or "APR". */
export const formatRewardRateLabel = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): string => formatRateTypeLabel(yieldDto.rewardRate.rateType, t);

export const formatRewardRate = (
  effectiveRewardRate: ReturnType<typeof getEffectiveYieldRewardRateDetails>,
  yieldDto: EarnYieldWithProvider,
  locale: string
) => {
  if (!effectiveRewardRate) return null;

  const amount = exactDecimal(effectiveRewardRate.total);

  if (!amount.isFinite()) return null;

  if (amount.isZero() && !isNonZeroRewardRateYield(yieldDto)) return null;

  return formatRoundedPercent(amount, locale);
};

export const formatMinStakeLabel = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): string =>
  getYieldCategory(yieldDto) === "rwa"
    ? t("dashboard.earn_details.minimum_subscription")
    : t("dashboard.earn_details.min_stake");

export const formatMinStake = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction,
  locale: string
): { kpiPrimaryEligible: boolean; value: string } | null => {
  const amount =
    yieldDto.mechanics.entryLimits?.minimum ??
    getYieldActionArg(yieldDto, "enter", "amount")?.minimum;

  if (!amount) return null;

  if (amount.isZero()) {
    return {
      kpiPrimaryEligible: false,
      value: t("dashboard.earn_details.no_minimum"),
    };
  }

  return {
    kpiPrimaryEligible: true,
    value: `${formatTokenAmount(amount, locale, "up")} ${yieldDto.token.symbol}`,
  };
};

export const formatRequirementStatus = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): string => {
  if (!yieldDto.status.enter) {
    return t("dashboard.earn_details.unavailable");
  }
  if (yieldDto.mechanics.requirements?.kycRequired) {
    return t("dashboard.earn_details.kyc_required");
  }
  return t("dashboard.earn_details.active");
};

export const formatCommission = (
  commission: string | number | null | undefined,
  locale: string
) => {
  if (commission == null) return null;

  const formatted = formatPercent(commission, locale);

  return formatted === unavailableFigure ? null : `Commission ${formatted}`;
};

export const formatProviderTvl = (
  tvl: BigNumber | null | undefined,
  tokenSymbol: string,
  locale: string
) => {
  if (!tvl) return null;

  const formatted = formatCompactNumber(tvl, locale);

  return formatted === unavailableFigure
    ? null
    : `TVL ${formatted} ${tokenSymbol}`;
};

export const formatProviderStatus = (
  status: string | null | undefined,
  t: TFunction
) => {
  if (!status) return null;

  if (status === "active") {
    return t("position_details.balance_type.active");
  }

  if (status === "jailed") {
    return t("details.validators_jailed");
  }

  return t("details.validators_inactive");
};

export const formatProviderWebsite = (website: string) => {
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^https?:\/\/(www\.)?/, "");
  }
};

export const formatProviderWebsiteHref = (website: string) =>
  /^https?:\/\//i.test(website) ? website : `https://${website}`;

export const formatRewardTokenLabel = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): string => {
  const symbol = yieldDto.outputToken?.symbol ?? yieldDto.token.symbol;

  return hasYieldBearingOutputToken(yieldDto)
    ? t("dashboard.earn_details.yield_bearing_reward_token", { symbol })
    : symbol;
};

/** The price per share to 4–6 significant digits, the one share-price rule. */
export const formatPricePerShare = (
  yieldDto: EarnYieldWithProvider,
  locale: string
): string | null => {
  const price = yieldDto.state?.pricePerShareState?.price;

  return price?.isGreaterThan(0) ? formatRatio(price, locale) : null;
};

export const formatCooldownDays = (days: number, t: TFunction): string => {
  return days > 0
    ? t("dashboard.earn_details.cooldown_days", { count: days })
    : t("dashboard.earn_details.instant");
};

export const formatRewardClaiming = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): string => {
  return yieldDto.mechanics.rewardClaiming === "auto"
    ? t("dashboard.earn_details.auto_compounding")
    : t("dashboard.earn_details.manual");
};

export const formatOptionalDays = (
  days: number | undefined,
  t: TFunction
): string | null => {
  if (!days || days <= 0) return null;

  return t("dashboard.earn_details.cooldown_days", {
    count: days,
  });
};

export const formatMeaningfulCompactUsd = (
  value: BigNumber | null | undefined,
  locale: string
) => {
  if (!value?.isGreaterThan(0)) return null;

  const formatted = formatUsd(value, locale);

  return formatted === unavailableFigure ? null : formatted;
};
