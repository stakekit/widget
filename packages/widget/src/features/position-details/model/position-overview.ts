import type BigNumber from "bignumber.js";
import { type DateTime, Option } from "effect";
import type { TFunction } from "i18next";

import { isCancellingBalance } from "../../../domain/earn/confidential";
import {
  getPositionShares,
  type TokenAmount,
} from "../../../domain/earn/denomination";
import type {
  ConfidentialHandle,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type { YieldRewardRate } from "../../../domain/earn/reward-rate";
import {
  getExtendedYieldType,
  isDepositYieldType,
} from "../../../domain/earn/yield";
import { exactDecimal } from "../../../domain/finance/exact";
import type { YieldRewardsSummary } from "../../../domain/portfolio/models";
import {
  getPositionValueTotal,
  getTokenSumsUsd,
  groupPositionBalanceRows,
  type PositionBalanceRow,
  type PositionBalancesByType,
  sortBalancesByPriority,
  type YieldBalanceType,
} from "../../../domain/portfolio/positions";
import type { Presentable } from "../../../shared/effect/async-result";
import {
  formatRoundedPercent,
  formatTokenAmountWithSymbol,
  formatUsd,
} from "../../../shared/lib/number-format";
import {
  formatRewardRateLabel,
  getEstimatedRewardsUsd,
  type YieldFactId,
} from "../../yield-summary/index";
import { formatPendingBalanceTiming } from "./pending-balance-timing";
import { getPositionEarned, type PositionEarned } from "./position-earned";

type PositionSummaryMetric = {
  id: "rate" | "earnings" | "earned";
  label: string;
  /** A short line under the value, such as the Earned total. */
  caption?: string;
  /** What an info button beside the label explains. */
  info?: { label: string; text: string };
  tone?: "success" | "danger" | "default";
  value: string;
};

/** What the position's summary card shows: its value and side figures. */
type PositionOverviewSummary = {
  /** The hero: the USD value when priced, else the token amount. */
  value: string;
  /** The token amount under a USD hero. */
  subvalue?: string;
  metrics: PositionSummaryMetric[];
};

type PositionOverviewBreakdownRow = {
  id: string;
  label: string;
  subValue?: string;
  /** An amount the user can collect now reads as a gain. */
  tone: "default" | "success";
  value: string;
};

type PositionOverviewDetailRow = {
  id: string;
  label: string;
  value: string;
};

export type PositionOverviewModel = {
  breakdownRows: PositionOverviewBreakdownRow[];
  detailRows: PositionOverviewDetailRow[];
  /** The yield's facts the page already shows, left out of its facts section. */
  omittedYieldFacts: YieldFactId[];
  summary: PositionOverviewSummary;
};

type ProviderDetail = {
  address?: string | undefined;
  name?: string | undefined;
};

/** The validators the position is staked with, by their reward rates. */
type PositionValidators = ReadonlyArray<{
  readonly rewardRate?: BigNumber | null | undefined;
}>;

/**
 * A position's page below its header: the summary card's figures, and what
 * its Details disclosure lists of the position itself. The yield's facts
 * section after it leaves out the summary's reward rate, which the page
 * already shows.
 */
export const getPositionOverviewModel = ({
  cancellingHandles = new Set(),
  integrationData,
  locale,
  now = null,
  personalizedRewardRate,
  positionBalancesByType,
  rewardsSummary,
  t,
  validators,
}: {
  /** Handles of pending balances whose cancel is in flight. */
  cancellingHandles?: ReadonlySet<ConfidentialHandle>;
  integrationData: EarnYieldWithProvider;
  locale: string;
  /** Presentation time; batch timing is omitted without it. */
  now?: DateTime.Utc | null;
  personalizedRewardRate?: YieldRewardRate | null | undefined;
  positionBalancesByType: PositionBalancesByType;
  /**
   * The wallet's tracked earnings as the page can present them; none when
   * untracked.
   */
  rewardsSummary?:
    | Presentable<Option.Option<YieldRewardsSummary>, unknown>
    | undefined;
  t: TFunction;
  /**
   * The validators of a position staked with them, whose average rate it
   * earns, as the positions list's row reads it; null for a position held
   * with the yield's provider.
   */
  validators: PositionValidators | null;
}): PositionOverviewModel => {
  const balanceRows = groupPositionBalanceRows(
    getBalancesByPriority(positionBalancesByType),
    (balance) => isCancellingBalance(balance, cancellingHandles)
  );
  // Shown only from a current success: while loading, and whenever the
  // latest attempt failed, even after an earlier success, the figure hides
  // rather than read a stale amount as current.
  const earned = getPositionEarned({
    locale,
    positionBalancesByType,
    rewardsSummary:
      rewardsSummary?._tag === "Ready" &&
      Option.isNone(rewardsSummary.refreshFailure)
        ? Option.getOrUndefined(rewardsSummary.value)
        : undefined,
    t,
  });
  const summary = getPositionSummary({
    earned,
    integrationData,
    locale,
    personalizedRewardRate,
    positionBalancesByType,
    t,
    validators,
  });

  return {
    breakdownRows: getBreakdownRows({
      balanceRows,
      integrationData,
      locale,
      now,
      t,
    }),
    detailRows: getDetailRows({
      locale,
      positionBalancesByType,
      t,
    }),
    omittedYieldFacts: summary.metrics.some((metric) => metric.id === "rate")
      ? ["reward-rate"]
      : [],
    summary,
  };
};

/**
 * The summary card: the position's total, in USD when priced with its token
 * amount under it, then its reward rate, what it would earn a year at that
 * rate, and what it has earned over the last 7 days when tracked.
 */
const getPositionSummary = ({
  earned,
  integrationData,
  locale,
  personalizedRewardRate,
  positionBalancesByType,
  t,
  validators,
}: {
  earned: PositionEarned | null;
  integrationData: EarnYieldWithProvider;
  locale: string;
  personalizedRewardRate?: YieldRewardRate | null | undefined;
  positionBalancesByType: PositionBalancesByType;
  t: TFunction;
  validators: PositionValidators | null;
}): PositionOverviewSummary => {
  const balances = getBalancesByPriority(positionBalancesByType);
  // The same total Manage shows, in the primary Value Token when priced.
  const sums = getPositionValueTotal(balances).filter((sum) =>
    sum.amount.isGreaterThan(0)
  );
  const totalUsd = getTokenSumsUsd(sums);
  const tokenLine = sums
    .map((sum) => formatTokenAmountWithSymbol(sum, locale))
    .join(" · ");
  // Hidden balances count zero, so a fully hidden position reads as hidden.
  const hidden =
    sums.length === 0 && balances.some((balance) => balance.isEncrypted);
  const getHero = (): Pick<PositionOverviewSummary, "subvalue" | "value"> => {
    if (hidden) return { value: t("shared.confidential.hidden") };
    if (totalUsd.isGreaterThan(0)) {
      return {
        value: formatUsd(totalUsd, locale),
        ...(tokenLine ? { subvalue: tokenLine } : {}),
      };
    }
    return { value: tokenLine || formatUsd(totalUsd, locale) };
  };

  const validatorRate =
    validators && validators.length > 0
      ? validators
          .reduce(
            (total, validator) =>
              total.plus(exactDecimal(validator.rewardRate ?? 0)),
            exactDecimal(0)
          )
          .dividedBy(validators.length)
      : null;
  const rate =
    personalizedRewardRate?.total === undefined
      ? (validatorRate ?? exactDecimal(integrationData.rewardRate.total))
      : exactDecimal(personalizedRewardRate.total);
  const hasRate = rate.isFinite() && !rate.isZero();
  const earnings = hasRate
    ? getEstimatedRewardsUsd({
        amountUsd: totalUsd,
        estimatedRewards: { rewardRateAverage: rate },
      })
    : null;
  const metrics: PositionSummaryMetric[] = [
    ...(hasRate
      ? [
          {
            id: "rate" as const,
            label: personalizedRewardRate
              ? t("position_details.personalized_apy")
              : formatRewardRateLabel(integrationData, t),
            value: formatRoundedPercent(rate, locale),
          },
        ]
      : []),
    ...(earnings
      ? [
          {
            id: "earnings" as const,
            label: t("position_details.estimated_earnings"),
            tone: "success" as const,
            value: t("position_details.earnings_per_year", {
              amount: formatUsd(earnings.yearly, locale),
            }),
          },
        ]
      : []),
    ...(earned
      ? [
          {
            id: "earned" as const,
            label: t("position_details.earned"),
            caption: earned.caption,
            info: {
              label: t("position_details.earned_info_label"),
              text: t("position_details.earned_info"),
            },
            tone: earned.tone,
            value: earned.value,
          },
        ]
      : []),
  ];

  return { ...getHero(), metrics };
};

/**
 * The position's Shares, one per share token, valued by the balances
 * carrying them when all are priced.
 */
const formatShares = ({
  locale,
  positionBalancesByType,
  t,
}: {
  locale: string;
  positionBalancesByType: PositionBalancesByType;
  t: TFunction;
}) => {
  const shares = getPositionShares(
    getBalancesByPriority(positionBalancesByType)
  );
  if (!shares) return null;
  if (shares._tag === "Hidden") return t("shared.confidential.hidden");

  const amounts = shares.groups
    .map((group: TokenAmount) => formatTokenAmountWithSymbol(group, locale))
    .join(" · ");
  const usd = formatUsdSubValue(shares.amountUsd, locale);

  return usd ? `${amounts} (${usd})` : amounts;
};

const getBreakdownRows = ({
  balanceRows,
  integrationData,
  locale,
  now,
  t,
}: {
  balanceRows: ReadonlyArray<PositionBalanceRow>;
  integrationData: EarnYieldWithProvider;
  locale: string;
  now: DateTime.Utc | null;
  t: TFunction;
}): PositionOverviewBreakdownRow[] => {
  const deposit = isDepositYieldType(getExtendedYieldType(integrationData));

  return balanceRows.map((row, index) => {
    const amountSubValue = row.token.isPoints
      ? t("shared.points")
      : formatUsdSubValue(row.amountUsd, locale);
    const batchTiming = formatPendingBalanceTiming({
      integrationData,
      now,
      row,
      t,
    });
    const shares =
      row.shares && !row.isEncrypted
        ? formatTokenAmountWithSymbol(row.shares, locale)
        : null;
    const subValue = [shares, amountSubValue, batchTiming]
      .filter((part) => !!part)
      .join(" · ");
    const collectable =
      !row.isEncrypted &&
      (row.type === "claimable" || row.type === "withdrawable");
    return {
      id: `${row.type}-${row.token.symbol}-${index}`,
      label: formatBalanceTypeLabel(row.type, deposit, t),
      ...(subValue ? { subValue } : {}),
      tone: collectable ? "success" : "default",
      value: row.isEncrypted
        ? t("shared.confidential.hidden")
        : formatTokenAmountWithSymbol(row, locale),
    };
  });
};

/**
 * What the Details disclosure lists of the position itself: its Shares. What
 * it has earned is the summary's, so it is not repeated here. The yield's
 * facts follow it in their own section.
 */
const getDetailRows = ({
  locale,
  positionBalancesByType,
  t,
}: {
  locale: string;
  positionBalancesByType: PositionBalancesByType;
  t: TFunction;
}): PositionOverviewDetailRow[] => {
  const shares = formatShares({ locale, positionBalancesByType, t });

  return shares
    ? [
        {
          id: "shares",
          label: t("dashboard.position_details.shares"),
          value: shares,
        },
      ]
    : [];
};

const getBalancesByPriority = (
  positionBalancesByType: PositionBalancesByType
) => sortBalancesByPriority([...positionBalancesByType.values()].flat());

const formatBalanceTypeLabel = (
  type: YieldBalanceType,
  deposit: boolean,
  t: TFunction
) =>
  t(
    `position_details.balance_type.${type}`,
    deposit ? { context: "yearn_or_deposit" } : {}
  );

const formatUsdSubValue = (
  value: string | number | BigNumber | null | undefined,
  locale: string
) => {
  if (value == null) return undefined;

  const amount = exactDecimal(value);

  return amount.isGreaterThan(0) ? formatUsd(amount, locale) : undefined;
};

export const getPositionHeaderBadges = (
  integrationData: EarnYieldWithProvider,
  t: TFunction
) => {
  const yieldType = getExtendedYieldType(integrationData);
  const badges: { label: string; tone: "auto" | "default" }[] = [];

  if (yieldType === "native_staking") {
    badges.push({
      label: t("dashboard.earn_details.native"),
      tone: "default",
    });
  }

  if (yieldType === "pooled_staking") {
    badges.push({
      label: t("dashboard.earn_details.pooled"),
      tone: "default",
    });
  }

  if (integrationData.mechanics.rewardClaiming === "auto") {
    badges.push({
      label: t("dashboard.earn_details.auto_compound"),
      tone: "auto",
    });
  }

  return badges;
};

/**
 * Who provides the position, as its header names it: its validator, else
 * the yield's provider.
 */
export const getPositionProviderName = ({
  integrationData,
  providersDetails,
}: {
  integrationData: EarnYieldWithProvider;
  providersDetails: ReadonlyArray<ProviderDetail>;
}) => {
  const [provider] = providersDetails;

  return (
    provider?.name ??
    provider?.address ??
    integrationData.provider?.name ??
    integrationData.providerId
  );
};
