import type BigNumber from "bignumber.js";
import { DateTime } from "effect";
import type { TFunction } from "i18next";
import type { PendingAction } from "../../../domain/action/models";
import {
  getPendingActionLabelContext,
  isOptionalPendingAction,
} from "../../../domain/action/pending-action";
import {
  isCancellingBalance,
  isConfidentialYield,
} from "../../../domain/earn/confidential";
import {
  getPositionShares,
  type TokenAmount,
} from "../../../domain/earn/denomination";
import type {
  ConfidentialHandle,
  EarnBalance,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type { YieldRewardRate } from "../../../domain/earn/reward-rate";
import {
  getExtendedYieldType,
  getYieldCooldownPeriod,
  getYieldLockupPeriod,
  getYieldRiskDisplay,
  getYieldTypeLabels,
  getYieldWarmupPeriod,
} from "../../../domain/earn/yield";
import { exactDecimal } from "../../../domain/finance/exact";
import type { RewardsSummary } from "../../../domain/portfolio/models";
import {
  formatPositionCallout,
  getPositionAttention,
  getPositionCallout,
  toInactiveValidatorStatus,
} from "../../../domain/portfolio/position-callout";
import {
  getPositionValueTotal,
  getTokenSumsUsd,
  groupPositionBalanceRows,
  type PositionBalanceRow,
  type PositionBalancesByType,
  sortBalancesByPriority,
  sumBalancesByToken,
  type YieldBalanceType,
} from "../../../domain/portfolio/positions";
import {
  formatNetworkName,
  humanizeEnumValue,
} from "../../../shared/lib/formatters";
import {
  formatRoundedPercent,
  formatTokenAmount,
  formatTokenAmountWithSymbol,
  formatUsd,
} from "../../../shared/lib/number-format";
import {
  formatCooldownDays,
  formatDailyBatch,
  formatMinStake,
  formatMinStakeLabel,
  formatNextBatchLabel,
  formatNextBatchTiming,
  formatOptionalDays,
  formatPricePerShare,
  formatRewardClaiming,
  formatRewardRateLabel,
  formatRewardTokenLabel,
} from "../../yield-summary/index";
import { formatPendingBalanceTiming } from "./pending-balance-timing";
import { getPricedFiat, type PricesStatus } from "./priced-fiat";

type PositionOverviewMetricCard = {
  id: string;
  label: string;
  subValue?: string | undefined;
  /** The sub-value is still loading, such as while prices load. */
  subValueLoading?: boolean | undefined;
  /** Several lines when a card lists one amount per token. */
  value: string | ReadonlyArray<string>;
};

type PositionOverviewBreakdownRow = {
  id: string;
  label: string;
  subValue?: string;
  value: string;
};

export type PositionOverviewDetailValue =
  | string
  | Readonly<{
      readonly _tag: "Risk";
      readonly risk: NonNullable<ReturnType<typeof getYieldRiskDisplay>>;
    }>;

type PositionOverviewDetailRow = {
  id: string;
  label: string;
  value: PositionOverviewDetailValue;
};

type PositionOverviewAddressRow = {
  address: string;
  label: string;
};

type PositionOverviewChartSection = {
  id: string;
  title: string;
};

export type PositionOverviewModel = {
  addressRows: PositionOverviewAddressRow[];
  breakdownRows: PositionOverviewBreakdownRow[];
  chartSections: PositionOverviewChartSection[];
  detailRows: PositionOverviewDetailRow[];
  metricCards: PositionOverviewMetricCard[];
};

type PositionOverviewPendingAction = {
  amount: BigNumber | null;
  amountUsd: BigNumber | null;
  /** Whether the prices that value `amount` are in, so `amountUsd` is too. */
  amountUsdStatus: PricesStatus;
  pendingAction: PendingAction;
  yieldBalance: EarnBalance;
};

type ProviderDetail = {
  address?: string | undefined;
  name?: string | undefined;
  rewardRate?: BigNumber | null | undefined;
  status?: string | null | undefined;
};

export const getPositionOverviewModel = ({
  cancellingHandles = new Set(),
  integrationData,
  locale,
  now = null,
  pendingActions,
  personalizedRewardRate,
  positionBalancesByType,
  providersDetails,
  rewardsSummary,
  t,
}: {
  /** Handles of pending balances whose cancel is in flight. */
  cancellingHandles?: ReadonlySet<ConfidentialHandle>;
  integrationData: EarnYieldWithProvider;
  locale: string;
  /** Presentation time; batch timing is omitted without it. */
  now?: DateTime.Utc | null;
  pendingActions: PositionOverviewPendingAction[];
  personalizedRewardRate?: YieldRewardRate | null | undefined;
  positionBalancesByType: PositionBalancesByType;
  providersDetails: ProviderDetail[];
  rewardsSummary?: RewardsSummary | undefined;
  t: TFunction;
}): PositionOverviewModel => {
  const promotedFactIds = new Set<string>();
  const balanceRows = groupPositionBalanceRows(
    getBalancesByPriority(positionBalancesByType),
    (balance) => isCancellingBalance(balance, cancellingHandles)
  );
  const providerName = getPositionProviderName({
    integrationData,
    providersDetails,
  });
  const balanceMetric = getBalanceMetric({
    locale,
    positionBalancesByType,
    promotedFactIds,
    t,
  });
  const sharesMetric = getSharesMetric({
    locale,
    positionBalancesByType,
    t,
  });
  const rewardsMetric = getRewardsMetric({
    locale,
    pendingActions,
    positionBalancesByType,
    promotedFactIds,
    rewardsSummary,
    t,
  });
  const apyMetric = getApyMetric({
    integrationData,
    locale,
    personalizedRewardRate,
    promotedFactIds,
    t,
  });
  // The status heads the page beside the position's name, not a card.
  const baseCards = [
    balanceMetric,
    sharesMetric,
    rewardsMetric,
    apyMetric,
  ].filter((card): card is PositionOverviewMetricCard => !!card);

  // Keep the 2-column grid balanced: when there is an odd number of cards,
  // surface the next most useful fact so the layout never leaves an empty cell.
  const fillerMetric =
    baseCards.length % 2 === 1
      ? getFillerMetric({
          balanceRows,
          integrationData,
          now,
          promotedFactIds,
          t,
        })
      : null;

  return {
    addressRows: getAddressRows(integrationData, t),
    breakdownRows: getBreakdownRows({
      balanceRows,
      integrationData,
      locale,
      now,
      t,
    }),
    chartSections: [],
    detailRows: getDetailRows({
      integrationData,
      locale,
      promotedFactIds,
      providerName,
      t,
    }),
    metricCards: fillerMetric ? [...baseCards, fillerMetric] : baseCards,
  };
};

const getFillerMetric = ({
  balanceRows,
  integrationData,
  now,
  promotedFactIds,
  t,
}: {
  balanceRows: ReadonlyArray<PositionBalanceRow>;
  integrationData: EarnYieldWithProvider;
  now: DateTime.Utc | null;
  promotedFactIds: Set<string>;
  t: TFunction;
}): PositionOverviewMetricCard | null => {
  // A dated pending withdrawal settles on its own date, whatever the vault's
  // next batch; batched vaults otherwise redeem with that batch. One being
  // cancelled will not settle at all.
  const ownWithdrawal = balanceRows.reduce<PositionBalanceRow | null>(
    (earliest, row) =>
      row.type === "exiting" &&
      !row.cancelling &&
      row.date &&
      (!earliest?.date || DateTime.isLessThan(row.date, earliest.date))
        ? row
        : earliest,
    null
  );
  const ownWithdrawalTiming = ownWithdrawal
    ? formatPendingBalanceTiming({
        integrationData,
        now,
        row: ownWithdrawal,
        t,
      })
    : null;
  const nextBatch = formatNextBatchTiming({
    now,
    side: "redemption",
    t,
    yieldDto: integrationData,
  });
  const cooldownDays = getYieldCooldownPeriod(integrationData)?.days ?? 0;
  const getRedemptionValue = () => {
    if (ownWithdrawalTiming) return ownWithdrawalTiming;
    if (nextBatch) return formatNextBatchLabel(nextBatch, t);
    return cooldownDays > 0 && !isConfidentialYield(integrationData)
      ? t("dashboard.earn_details.cooldown_days", { count: cooldownDays })
      : null;
  };
  const redemptionValue = getRedemptionValue();

  if (redemptionValue) {
    promotedFactIds.add("cooldown");

    return {
      id: "unstaking-period",
      label: t("dashboard.earn_details.cooldown"),
      value: redemptionValue,
    };
  }

  const rewardToken = formatRewardTokenLabel(integrationData, t);

  if (rewardToken) {
    promotedFactIds.add("reward-token");

    return {
      id: "reward-token",
      label: t("dashboard.earn_details.reward_token"),
      value: rewardToken,
    };
  }

  return null;
};

const getPositionProviderName = ({
  integrationData,
  providersDetails,
}: {
  integrationData: EarnYieldWithProvider;
  providersDetails: ProviderDetail[];
}) => {
  const [provider] = providersDetails;

  return (
    provider?.name ??
    provider?.address ??
    integrationData.provider?.name ??
    integrationData.providerId
  );
};

const getBalanceMetric = ({
  locale,
  positionBalancesByType,
  promotedFactIds,
  t,
}: {
  locale: string;
  positionBalancesByType: PositionBalancesByType;
  promotedFactIds: Set<string>;
  t: TFunction;
}): PositionOverviewMetricCard | null => {
  // The same total Manage shows, in the primary Value Token when priced.
  const sums = getPositionValueTotal(
    getBalancesByPriority(positionBalancesByType)
  );
  const totalUsd = getTokenSumsUsd(sums);
  // Hidden balances count zero, so a fully hidden position shows no Balance.
  if (
    !sums.some((sum) => sum.amount.isGreaterThan(0)) &&
    !totalUsd.isGreaterThan(0)
  ) {
    return null;
  }

  promotedFactIds.add("balance");

  return {
    id: "balance",
    label: t("dashboard.position_details.balance"),
    subValue: formatUsdSubValue(totalUsd, locale),
    value: formatTokenSums(sums, locale),
  };
};

/**
 * The position's Shares, one line per share token, valued by the balances
 * carrying them when all are priced.
 */
const getSharesMetric = ({
  locale,
  positionBalancesByType,
  t,
}: {
  locale: string;
  positionBalancesByType: PositionBalancesByType;
  t: TFunction;
}): PositionOverviewMetricCard | null => {
  const shares = getPositionShares(
    getBalancesByPriority(positionBalancesByType)
  );
  if (!shares) return null;
  const label = t("dashboard.position_details.shares");
  if (shares._tag === "Hidden") {
    return { id: "shares", label, value: t("shared.confidential.hidden") };
  }

  return {
    id: "shares",
    label,
    ...(shares.amountUsd
      ? { subValue: formatUsdSubValue(shares.amountUsd, locale) }
      : {}),
    value: formatTokenSums(shares.groups, locale),
  };
};

const getRewardsMetric = ({
  locale,
  pendingActions,
  positionBalancesByType,
  promotedFactIds,
  rewardsSummary,
  t,
}: {
  locale: string;
  pendingActions: PositionOverviewPendingAction[];
  positionBalancesByType: PositionBalancesByType;
  promotedFactIds: Set<string>;
  rewardsSummary?: RewardsSummary | undefined;
  t: TFunction;
}): PositionOverviewMetricCard | null => {
  const claimableSums = getPositiveTokenSums(
    positionBalancesByType.get("claimable") ?? []
  );

  if (claimableSums.length > 0) {
    promotedFactIds.add("rewards");

    return {
      id: "rewards",
      label: t("dashboard.position_details.rewards"),
      subValue: formatUsdSubValue(getTokenSumsUsd(claimableSums), locale),
      value: formatTokenSums(claimableSums, locale),
    };
  }

  if (rewardsSummary?.rewards.total.isGreaterThan(0)) {
    promotedFactIds.add("rewards");

    return {
      id: "rewards",
      label: t("dashboard.position_details.rewards"),
      subValue: t("dashboard.position_details.rewards_total"),
      value: `${formatTokenAmount(rewardsSummary.rewards.total, locale, "down")} ${
        rewardsSummary.token.symbol
      }`,
    };
  }

  const claimAction = pendingActions.find(
    (action) => action.pendingAction.type === "CLAIM_REWARDS"
  );

  if (!claimAction) return null;

  promotedFactIds.add("rewards");
  // Only a claim amount is valued by prices; without one there is no figure.
  const fiat = claimAction.amount
    ? getPricedFiat({
        amountUsd: claimAction.amountUsd,
        locale,
        status: claimAction.amountUsdStatus,
      })
    : null;

  return {
    id: "rewards",
    label: t("dashboard.position_details.rewards"),
    ...(fiat?.fiatValue ? { subValue: fiat.fiatValue } : {}),
    ...(fiat?.fiatValueLoading ? { subValueLoading: true } : {}),
    value: t("position_details.pending_action.claim_rewards"),
  };
};

const getApyMetric = ({
  integrationData,
  locale,
  personalizedRewardRate,
  promotedFactIds,
  t,
}: {
  integrationData: EarnYieldWithProvider;
  locale: string;
  personalizedRewardRate?: YieldRewardRate | null | undefined;
  promotedFactIds: Set<string>;
  t: TFunction;
}): PositionOverviewMetricCard | null => {
  const rewardRate =
    personalizedRewardRate?.total ?? integrationData.rewardRate.total;
  const amount = exactDecimal(rewardRate);

  if (!amount.isFinite() || amount.isZero()) return null;

  promotedFactIds.add("apy");

  return {
    id: "apy",
    label: personalizedRewardRate
      ? t("position_details.personalized_apy")
      : formatRewardRateLabel(integrationData, t),
    value: formatRoundedPercent(amount, locale),
  };
};

/**
 * A position's state when the positions list calls nothing out: the optional
 * actions it offers, a cancel in flight, the balance in motion, else whether
 * it is active.
 */
const getPositionState = ({
  canUnstake,
  cancelling,
  pendingActions,
  positionBalancesByType,
  t,
}: {
  canUnstake: boolean;
  cancelling: boolean;
  pendingActions: PositionOverviewPendingAction[];
  positionBalancesByType: PositionBalancesByType;
  t: TFunction;
}): string => {
  const optionalActions = pendingActions.filter((action) =>
    isOptionalPendingAction(action.pendingAction.type)
  );
  const [onlyOptionalAction, ...otherOptionalActions] = optionalActions;
  // Several optional requests are counted; none is singled out over another.
  if (otherOptionalActions.length > 0) {
    return t("dashboard.position_details.actions_available", {
      count: optionalActions.length,
    });
  }
  if (onlyOptionalAction)
    return formatPendingActionLabel(onlyOptionalAction, t);
  if (cancelling) return t("position_details.cancelling");

  const statusBalance = getBalancesByPriority(positionBalancesByType).find(
    (balance) =>
      balance.type === "withdrawable" ||
      balance.type === "exiting" ||
      balance.type === "entering"
  );
  if (statusBalance) return formatBalanceTypeLabel(statusBalance.type, t);

  return canUnstake
    ? t("dashboard.position_details.active")
    : t("dashboard.position_details.withdrawal_unavailable");
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
}): PositionOverviewBreakdownRow[] =>
  balanceRows.map((row, index) => {
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
    return {
      id: `${row.type}-${row.token.symbol}-${index}`,
      label: formatBalanceTypeLabel(row.type, t),
      ...(subValue ? { subValue } : {}),
      value: row.isEncrypted
        ? t("shared.confidential.hidden")
        : formatTokenAmountWithSymbol(row, locale),
    };
  });

const getDetailRows = ({
  integrationData,
  locale,
  promotedFactIds,
  providerName,
  t,
}: {
  integrationData: EarnYieldWithProvider;
  locale: string;
  promotedFactIds: Set<string>;
  providerName: string;
  t: TFunction;
}): PositionOverviewDetailRow[] => {
  const risk = getYieldRiskDisplay(integrationData);
  const minStake = formatMinStake(integrationData, t, locale);
  const pricePerShare = formatPricePerShare(integrationData, locale);
  const confidential = isConfidentialYield(integrationData);
  const cooldown = confidential
    ? null
    : (formatDailyBatch({ side: "redemption", t, yieldDto: integrationData }) ??
      formatCooldownDays(
        getYieldCooldownPeriod(integrationData)?.days ?? 0,
        t
      ));
  const warmup = confidential
    ? null
    : (formatDailyBatch({
        side: "subscription",
        t,
        yieldDto: integrationData,
      }) ?? formatOptionalDays(getYieldWarmupPeriod(integrationData)?.days, t));
  const lockup = formatOptionalDays(
    getYieldLockupPeriod(integrationData)?.days,
    t
  );

  const rows: Array<PositionOverviewDetailRow | null> = [
    {
      id: "network",
      label: t("dashboard.earn_details.network"),
      value: formatNetworkName(integrationData.network),
    },
    {
      id: "provider",
      label: t("dashboard.earn_details.provider"),
      value: providerName,
    },
    promotedFactIds.has("reward-token")
      ? null
      : {
          id: "reward-token",
          label: t("dashboard.earn_details.reward_token"),
          value: formatRewardTokenLabel(integrationData, t),
        },
    pricePerShare
      ? {
          id: "price-per-share",
          label: t("dashboard.earn_details.price_per_share"),
          value: pricePerShare,
        }
      : null,
    {
      id: "type",
      label: t("dashboard.earn_details.type"),
      value: getYieldTypeLabels(integrationData, t).title,
    },
    {
      id: "reward-schedule",
      label: t("dashboard.earn_details.reward_schedule"),
      value: humanizeEnumValue(integrationData.mechanics.rewardSchedule),
    },
    {
      id: "reward-claiming",
      label: t("dashboard.earn_details.reward_claiming"),
      value: formatRewardClaiming(integrationData, t),
    },
    promotedFactIds.has("apy")
      ? null
      : {
          id: "apy",
          label: formatRewardRateLabel(integrationData, t),
          value: formatRoundedPercent(integrationData.rewardRate.total, locale),
        },
    minStake
      ? {
          id: "min-stake",
          label: formatMinStakeLabel(integrationData, t),
          value: minStake.value,
        }
      : null,
    promotedFactIds.has("cooldown") || !cooldown
      ? null
      : {
          id: "cooldown",
          label: t("dashboard.earn_details.cooldown"),
          value: cooldown,
        },
    warmup
      ? {
          id: "warmup",
          label: t("dashboard.earn_details.warmup"),
          value: warmup,
        }
      : null,
    lockup
      ? {
          id: "lockup",
          label: t("dashboard.earn_details.lockup"),
          value: lockup,
        }
      : null,
    risk
      ? {
          id: "risk",
          label: t("dashboard.earn_details.risk"),
          value: { _tag: "Risk", risk },
        }
      : null,
  ];

  return rows.filter((row): row is PositionOverviewDetailRow => !!row);
};

const getAddressRows = (
  integrationData: EarnYieldWithProvider,
  t: TFunction
): PositionOverviewAddressRow[] => {
  const rows: Array<PositionOverviewAddressRow | null> = [
    integrationData.outputToken?.address
      ? {
          label: t("dashboard.earn_details.vault"),
          address: integrationData.outputToken.address,
        }
      : null,
    integrationData.token.address
      ? {
          label: t("dashboard.earn_details.asset", {
            symbol: integrationData.token.symbol,
          }),
          address: integrationData.token.address,
        }
      : null,
  ];

  return rows.filter((row): row is PositionOverviewAddressRow => row !== null);
};

const getBalancesByPriority = (
  positionBalancesByType: PositionBalancesByType
) => sortBalancesByPriority([...positionBalancesByType.values()].flat());

const formatBalanceTypeLabel = (type: YieldBalanceType, t: TFunction) =>
  t(`position_details.balance_type.${type}`);

const getPositiveTokenSums = (balances: ReadonlyArray<EarnBalance>) =>
  sumBalancesByToken(
    balances.filter((balance) => !balance.token.isPoints)
  ).filter((sum) => sum.amount.isGreaterThan(0));

const formatTokenSums = (sums: ReadonlyArray<TokenAmount>, locale: string) => {
  const lines = sums.map((sum) => formatTokenAmountWithSymbol(sum, locale));

  return lines.length === 1 ? (lines[0] ?? "") : lines;
};

// Pending action types come from the API and can outpace our translation map
// (e.g. RWA-specific actions). Fall back to a humanized version of the type so
// the card never renders a raw translation key.
const formatPendingActionLabel = (
  { pendingAction, yieldBalance }: PositionOverviewPendingAction,
  t: TFunction
) =>
  t(`position_details.pending_action.${pendingAction.type.toLowerCase()}`, {
    context: getPendingActionLabelContext(
      pendingAction.type,
      yieldBalance.type
    ),
    defaultValue: humanizeEnumValue(pendingAction.type),
  });

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
 * What heads a position's page beside its name: who provides it and the
 * position's status. A status the positions list calls out reads as its row
 * does, in the same tone; otherwise the status is the position's state, such
 * as Active or Unstaking, in the neutral tone.
 */
export const getPositionHeaderModel = ({
  cancellingHandles = new Set(),
  canUnstake,
  integrationData,
  pendingActions,
  positionBalancesByType,
  providersDetails,
  t,
}: {
  cancellingHandles?: ReadonlySet<ConfidentialHandle>;
  canUnstake: boolean;
  integrationData: EarnYieldWithProvider;
  pendingActions: PositionOverviewPendingAction[];
  positionBalancesByType: PositionBalancesByType;
  providersDetails: ProviderDetail[];
  t: TFunction;
}): {
  readonly providerName: string;
  readonly status: {
    readonly label: string;
    readonly tone: "info" | "neutral" | "warning";
  };
} => {
  const balances = getBalancesByPriority(positionBalancesByType);
  const callout = getPositionCallout({
    attention: getPositionAttention({
      balanceTypes: balances
        .filter((balance) => hasPositionAmount(balance))
        .map((balance) => balance.type),
      pendingActions: pendingActions.map(({ pendingAction, yieldBalance }) => ({
        type: pendingAction.type,
        balance: yieldBalance,
      })),
    }),
    inactiveValidator: toInactiveValidatorStatus(providersDetails),
  });
  const providerName = getPositionProviderName({
    integrationData,
    providersDetails,
  });

  if (callout !== null) {
    return {
      providerName,
      status: {
        label: formatPositionCallout(callout, t),
        tone: callout === "inProgress" ? "info" : "warning",
      },
    };
  }

  return {
    providerName,
    status: {
      label: getPositionState({
        canUnstake,
        cancelling: groupPositionBalanceRows(balances, (balance) =>
          isCancellingBalance(balance, cancellingHandles)
        ).some((row) => row.cancelling),
        pendingActions,
        positionBalancesByType,
        t,
      }),
      tone: "neutral",
    },
  };
};

/** A balance with an amount, or one whose amount is hidden. */
const hasPositionAmount = (balance: EarnBalance) => {
  const amount = exactDecimal(balance.amount);
  return balance.isEncrypted === true || (!amount.isZero() && !amount.isNaN());
};
