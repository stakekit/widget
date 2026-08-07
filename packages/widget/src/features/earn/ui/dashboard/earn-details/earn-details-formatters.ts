import BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/schema/earn-models";
import type { getEffectiveYieldRewardRateDetails } from "../../../../../domain/types/reward-rate";
import {
  getDashboardYieldCategory,
  getYieldActionArg,
  hasYieldBearingOutputToken,
  isNonZeroRewardRateYield,
} from "../../../../../domain/types/yields";
import {
  formatCompactNumber,
  formatPercent,
  formatUsd,
  getRewardTypeFormatted,
} from "../../../../../shared/lib/formatters";
import { APToPercentage } from "../../../../../shared/lib/general";
import { formatNumber } from "../../../../../shared/lib/number-format";

export const formatDisplayTokenSymbol = (yieldDto: EarnYieldWithProvider) =>
  yieldDto.outputToken?.symbol ?? yieldDto.token.symbol;

export const formatRewardRateLabel = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): string => {
  const rewardType =
    getRewardTypeFormatted(yieldDto.rewardRate.rateType.toLowerCase()) ||
    t("dashboard.earn_details.apy");

  return getDashboardYieldCategory(yieldDto) === "stake"
    ? rewardType
    : t("dashboard.earn_details.reward_rate_period", {
        rewardType,
      });
};

export const formatRewardRate = (
  effectiveRewardRate: ReturnType<typeof getEffectiveYieldRewardRateDetails>,
  yieldDto: EarnYieldWithProvider
) => {
  if (!effectiveRewardRate) return null;

  const amount = BigNumber(effectiveRewardRate.total);

  if (!amount.isFinite()) return null;

  if (amount.isZero() && !isNonZeroRewardRateYield(yieldDto)) return null;

  return `${APToPercentage(amount.toNumber())}%`;
};

export const formatMinStakeLabel = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): string =>
  getDashboardYieldCategory(yieldDto) === "rwa"
    ? t("dashboard.earn_details.minimum_subscription")
    : t("dashboard.earn_details.min_stake");

export const formatMinStake = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): { kpiPrimaryEligible: boolean; value: string } | null => {
  const minimum =
    yieldDto.mechanics.entryLimits?.minimum ??
    getYieldActionArg(yieldDto, "enter", "amount")?.minimum;

  if (minimum === null || minimum === undefined) return null;

  const amount = BigNumber(minimum);

  if (!amount.isFinite()) return null;

  if (amount.isZero()) {
    return {
      kpiPrimaryEligible: false,
      value: t("dashboard.earn_details.no_minimum") as string,
    };
  }

  return {
    kpiPrimaryEligible: true,
    value: `${formatNumber(amount, amount.isInteger() ? 0 : 6)} ${
      yieldDto.token.symbol
    }`,
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
  commission: string | number | null | undefined
) => {
  if (commission == null) return null;

  const formatted = formatPercent(commission);

  return formatted === "-" ? null : `Commission ${formatted}`;
};

export const formatProviderTvl = (
  tvl: string | number | null | undefined,
  tokenSymbol: string
) => {
  if (tvl === null || tvl === undefined) return null;

  const formatted = formatCompactNumber(tvl);

  return formatted === "-" ? null : `TVL ${formatted} ${tokenSymbol}`;
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

export const formatPricePerShare = (
  yieldDto: EarnYieldWithProvider
): string | null => {
  const price = yieldDto.state?.pricePerShareState?.price;

  if (price === null || price === undefined) return null;

  const amount = BigNumber(price);

  if (!amount.isFinite() || amount.isLessThanOrEqualTo(0)) return null;

  return formatNumber(amount, 8);
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
  value: string | number | null | undefined
) => {
  if (!isPositiveFinite(value)) return null;

  const formatted = formatUsd(value);

  return formatted === "-" ? null : formatted;
};

export const formatMeaningfulCompactNumber = (
  value: string | number | null | undefined
) => {
  if (!isPositiveFinite(value)) return null;

  const formatted = formatCompactNumber(value);

  return formatted === "-" ? null : formatted;
};

const isPositiveFinite = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return false;

  const amount = BigNumber(value);

  return amount.isFinite() && amount.isGreaterThan(0);
};
