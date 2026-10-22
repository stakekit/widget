import type BigNumber from "bignumber.js";
import type { DateTime } from "effect";
import type { TFunction } from "i18next";
import type { PendingAction } from "../../../domain/action/models";
import { getPendingActionLabelContext } from "../../../domain/action/pending-action";
import type {
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
import { exactDecimal, exactZero } from "../../../domain/finance/exact";
import type { RewardsSummary } from "../../../domain/portfolio/models";
import {
  groupPositionBalanceRows,
  type PositionBalancesByType,
  type PositionTokenSum,
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

type DashboardPositionStatusTone = "action" | "claim" | "default";

type DashboardPositionMetricCard = {
  id: string;
  label: string;
  subValue?: string;
  tone?: DashboardPositionStatusTone;
  /** Several lines when a card lists one amount per token. */
  value: string | ReadonlyArray<string>;
};

type DashboardPositionStatusSummary = {
  label: string;
  tone: DashboardPositionStatusTone;
  value: string;
} | null;

type DashboardPositionBreakdownRow = {
  id: string;
  label: string;
  subValue?: string;
  value: string;
};

export type DashboardPositionDetailValue =
  | string
  | Readonly<{
      readonly _tag: "Risk";
      readonly risk: NonNullable<ReturnType<typeof getYieldRiskDisplay>>;
    }>;

type DashboardPositionDetailRow = {
  id: string;
  label: string;
  value: DashboardPositionDetailValue;
};

type DashboardPositionAddressRow = {
  address: string;
  label: string;
};

type DashboardPositionChartSection = {
  id: string;
  title: string;
};

type DashboardPositionDetailsModel = {
  addressRows: DashboardPositionAddressRow[];
  breakdownRows: DashboardPositionBreakdownRow[];
  chartSections: DashboardPositionChartSection[];
  detailRows: DashboardPositionDetailRow[];
  metricCards: DashboardPositionMetricCard[];
  providerName: string;
  statusSummary: DashboardPositionStatusSummary;
};

type DashboardPositionPendingAction = {
  amount: BigNumber | null;
  amountUsd: BigNumber | null;
  pendingAction: PendingAction;
  yieldBalance: EarnBalance;
};

type ProviderDetail = {
  address?: string;
  name?: string;
  rewardRate?: BigNumber | null;
  status?: string | null;
};

export const getDashboardPositionDetailsModel = ({
  canUnstake,
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
  canUnstake: boolean;
  integrationData: EarnYieldWithProvider;
  locale: string;
  /** Presentation time; batch timing is omitted without it. */
  now?: DateTime.Utc | null;
  pendingActions: DashboardPositionPendingAction[];
  personalizedRewardRate?: YieldRewardRate | null;
  positionBalancesByType: PositionBalancesByType;
  providersDetails: ProviderDetail[];
  rewardsSummary?: RewardsSummary;
  t: TFunction;
}): DashboardPositionDetailsModel => {
  const promotedFactIds = new Set<string>();
  const providerName = getPositionProviderName({
    integrationData,
    providersDetails,
  });
  const statusSummary = getStatusSummary({
    canUnstake,
    pendingActions,
    positionBalancesByType,
    providersDetails,
    t,
  });
  const balanceMetric = getBalanceMetric({
    locale,
    positionBalancesByType,
    promotedFactIds,
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
  const statusMetric = statusSummary
    ? {
        id: "status",
        label: statusSummary.label,
        tone: statusSummary.tone,
        value: statusSummary.value,
      }
    : null;

  const baseCards = [
    balanceMetric,
    rewardsMetric,
    apyMetric,
    statusMetric,
  ].filter((card): card is DashboardPositionMetricCard => !!card);

  // Keep the 2-column grid balanced: when there is an odd number of cards,
  // surface the next most useful fact so the layout never leaves an empty cell.
  const fillerMetric =
    baseCards.length % 2 === 1
      ? getFillerMetric({ integrationData, now, promotedFactIds, t })
      : null;

  return {
    addressRows: getAddressRows(integrationData, t),
    breakdownRows: getBreakdownRows({
      integrationData,
      locale,
      now,
      positionBalancesByType,
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
    providerName,
    statusSummary,
  };
};

const getFillerMetric = ({
  integrationData,
  now,
  promotedFactIds,
  t,
}: {
  integrationData: EarnYieldWithProvider;
  now: DateTime.Utc | null;
  promotedFactIds: Set<string>;
  t: TFunction;
}): DashboardPositionMetricCard | null => {
  // Batched vaults redeem with their next batch, not after a fixed cooldown.
  const nextBatch = formatNextBatchTiming({
    now,
    side: "redemption",
    t,
    yieldDto: integrationData,
  });
  const cooldownDays = getYieldCooldownPeriod(integrationData)?.days ?? 0;
  const getRedemptionValue = () => {
    if (nextBatch) return formatNextBatchLabel(nextBatch, t);
    return cooldownDays > 0
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
}): DashboardPositionMetricCard | null => {
  const activeSums = getPositiveTokenSums(
    positionBalancesByType.get("active") ?? []
  );

  if (activeSums.length > 0) {
    promotedFactIds.add("balance");

    return {
      id: "balance",
      label: t("dashboard.position_details.balance"),
      subValue: formatUsdSubValue(sumUsd(activeSums), locale),
      value: formatTokenSums(activeSums, locale),
    };
  }

  const totalUsd = getNonPointsBalances(positionBalancesByType).reduce(
    (acc, balance) => acc.plus(balance.amountUsd ?? 0),
    exactZero()
  );

  if (!totalUsd.isGreaterThan(0)) return null;

  promotedFactIds.add("balance");

  return {
    id: "balance",
    label: t("dashboard.position_details.balance"),
    value: formatUsd(totalUsd, locale),
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
  pendingActions: DashboardPositionPendingAction[];
  positionBalancesByType: PositionBalancesByType;
  promotedFactIds: Set<string>;
  rewardsSummary?: RewardsSummary;
  t: TFunction;
}): DashboardPositionMetricCard | null => {
  const claimableSums = getPositiveTokenSums(
    positionBalancesByType.get("claimable") ?? []
  );

  if (claimableSums.length > 0) {
    promotedFactIds.add("rewards");

    return {
      id: "rewards",
      label: t("dashboard.position_details.rewards"),
      subValue: formatUsdSubValue(sumUsd(claimableSums), locale),
      value: formatTokenSums(claimableSums, locale),
    };
  }

  if (
    rewardsSummary &&
    exactDecimal(rewardsSummary.rewards.total).isGreaterThan(0)
  ) {
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

  return {
    id: "rewards",
    label: t("dashboard.position_details.rewards"),
    subValue: claimAction.amountUsd
      ? formatUsd(claimAction.amountUsd, locale)
      : undefined,
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
  personalizedRewardRate?: YieldRewardRate | null;
  promotedFactIds: Set<string>;
  t: TFunction;
}): DashboardPositionMetricCard | null => {
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

const getStatusSummary = ({
  canUnstake,
  pendingActions,
  positionBalancesByType,
  providersDetails,
  t,
}: {
  canUnstake: boolean;
  pendingActions: DashboardPositionPendingAction[];
  positionBalancesByType: PositionBalancesByType;
  providersDetails: ProviderDetail[];
  t: TFunction;
}): DashboardPositionStatusSummary => {
  const inactiveProvider = providersDetails.find(
    (provider) => provider.status && provider.status !== "active"
  );

  if (inactiveProvider) {
    return {
      label: t("dashboard.position_details.action_required"),
      tone: "action",
      value:
        inactiveProvider.status === "jailed"
          ? t("details.validators_jailed")
          : t("details.validators_inactive"),
    };
  }

  // Cancelling a queued request is optional, so any other pending action
  // outranks it for the status card.
  const pendingAction =
    pendingActions.find(
      (action) => action.pendingAction.type !== "CANCEL_PENDING"
    ) ?? pendingActions[0];

  if (pendingAction) {
    const optional = pendingAction.pendingAction.type === "CANCEL_PENDING";

    return {
      label: optional
        ? t("dashboard.position_details.action_available")
        : t("dashboard.position_details.action_required"),
      tone: getPendingActionTone(pendingAction.pendingAction.type),
      value: formatPendingActionLabel(pendingAction, t),
    };
  }

  const statusBalance = getBalancesByPriority(positionBalancesByType).find(
    (balance) =>
      balance.type === "locked" ||
      balance.type === "withdrawable" ||
      balance.type === "exiting" ||
      balance.type === "entering"
  );

  if (statusBalance) {
    return {
      label: t("dashboard.position_details.status"),
      tone: "default",
      value: formatBalanceTypeLabel(statusBalance.type, t),
    };
  }

  return {
    label: t("dashboard.position_details.status"),
    tone: "default",
    value: canUnstake
      ? t("dashboard.position_details.active")
      : t("dashboard.position_details.withdrawal_unavailable"),
  };
};

// Undated pending balances of batched vaults settle with the next batch.
const getPendingBatchTiming = ({
  integrationData,
  now,
  row,
  t,
}: {
  integrationData: EarnYieldWithProvider;
  now: DateTime.Utc | null;
  row: { date?: DateTime.Utc | null; type: YieldBalanceType };
  t: TFunction;
}) => {
  const { type } = row;
  if (row.date || (type !== "entering" && type !== "exiting")) return null;
  const nextBatch = formatNextBatchTiming({
    now,
    side: type === "entering" ? "subscription" : "redemption",
    t,
    yieldDto: integrationData,
  });
  return nextBatch ? formatNextBatchLabel(nextBatch, t) : null;
};

const getBreakdownRows = ({
  integrationData,
  locale,
  now,
  positionBalancesByType,
  t,
}: {
  integrationData: EarnYieldWithProvider;
  locale: string;
  now: DateTime.Utc | null;
  positionBalancesByType: PositionBalancesByType;
  t: TFunction;
}): DashboardPositionBreakdownRow[] =>
  groupPositionBalanceRows(getBalancesByPriority(positionBalancesByType)).map(
    (row, index) => {
      const amountSubValue = row.token.isPoints
        ? t("shared.points")
        : formatUsdSubValue(row.amountUsd, locale);
      const batchTiming = getPendingBatchTiming({
        integrationData,
        now,
        row,
        t,
      });
      const subValue = [amountSubValue, batchTiming]
        .filter((part) => !!part)
        .join(" · ");
      return {
        id: `${row.type}-${row.token.symbol}-${index}`,
        label: formatBalanceTypeLabel(row.type, t),
        subValue: subValue || undefined,
        value: row.isEncrypted
          ? t("shared.confidential.hidden")
          : `${formatTokenAmount(row.amount, locale, "down")} ${row.token.symbol}`,
      };
    }
  );

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
}): DashboardPositionDetailRow[] => {
  const risk = getYieldRiskDisplay(integrationData);
  const minStake = formatMinStake(integrationData, t, locale);
  const pricePerShare = formatPricePerShare(integrationData, locale);
  const cooldown =
    formatDailyBatch({ side: "redemption", t, yieldDto: integrationData }) ??
    formatCooldownDays(getYieldCooldownPeriod(integrationData)?.days ?? 0, t);
  const warmup =
    formatDailyBatch({ side: "subscription", t, yieldDto: integrationData }) ??
    formatOptionalDays(getYieldWarmupPeriod(integrationData)?.days, t);
  const lockup = formatOptionalDays(
    getYieldLockupPeriod(integrationData)?.days,
    t
  );

  const rows: Array<DashboardPositionDetailRow | null> = [
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
    promotedFactIds.has("cooldown")
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

  return rows.filter((row): row is DashboardPositionDetailRow => !!row);
};

const getAddressRows = (
  integrationData: EarnYieldWithProvider,
  t: TFunction
): DashboardPositionAddressRow[] => {
  const rows: Array<DashboardPositionAddressRow | null> = [
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

  return rows.filter((row): row is DashboardPositionAddressRow => row !== null);
};

const getBalancesByPriority = (
  positionBalancesByType: PositionBalancesByType
) =>
  balanceTypePriority.flatMap((type) => positionBalancesByType.get(type) ?? []);

const getNonPointsBalances = (positionBalancesByType: PositionBalancesByType) =>
  getBalancesByPriority(positionBalancesByType).filter(
    (balance) => !balance.token.isPoints
  );

const balanceTypePriority: YieldBalanceType[] = [
  "active",
  "entering",
  "exiting",
  "withdrawable",
  "claimable",
  "locked",
];

const formatBalanceTypeLabel = (type: YieldBalanceType, t: TFunction) =>
  t(`position_details.balance_type.${type}`);

const getPositiveTokenSums = (balances: ReadonlyArray<EarnBalance>) =>
  sumBalancesByToken(
    balances.filter((balance) => !balance.token.isPoints)
  ).filter((sum) => sum.amount.isGreaterThan(0));

const sumUsd = (sums: ReadonlyArray<PositionTokenSum>) =>
  sums.reduce((total, sum) => total.plus(sum.amountUsd), exactZero());

const formatTokenSums = (
  sums: ReadonlyArray<PositionTokenSum>,
  locale: string
) => {
  const lines = sums.map(
    (sum) =>
      `${formatTokenAmount(sum.amount, locale, "down")} ${sum.token.symbol}`
  );

  return lines.length === 1 ? (lines[0] ?? "") : lines;
};

const getPendingActionTone = (
  type: PendingAction["type"]
): DashboardPositionStatusTone => {
  if (type === "CLAIM_REWARDS") return "claim";
  if (type === "CANCEL_PENDING") return "default";
  return "action";
};

// Pending action types come from the API and can outpace our translation map
// (e.g. RWA-specific actions). Fall back to a humanized version of the type so
// the card never renders a raw translation key.
const formatPendingActionLabel = (
  { pendingAction, yieldBalance }: DashboardPositionPendingAction,
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
