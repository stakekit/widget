import BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import {
  RiskRatingBadge,
  riskSummaryActions,
  YieldRiskInfoTooltip,
} from "../../components/molecules/yield-risk";
import type { YieldPendingActionDto } from "../../domain/types/pending-action";
import type {
  PositionBalancesByType,
  YieldBalanceDto,
  YieldBalanceType,
} from "../../domain/types/positions";
import type { YieldRewardRateDto } from "../../domain/types/reward-rate";
import {
  getExtendedYieldType,
  getYieldCooldownPeriod,
  getYieldLockupPeriod,
  getYieldRiskDisplay,
  getYieldTypeLabels,
  getYieldWarmupPeriod,
  type Yield,
} from "../../domain/types/yields";
import type { YieldRewardsSummaryResponseDto } from "../../generated/api/legacy";
import { APToPercentage, defaultFormattedNumber } from "../../utils";
import {
  formatCooldownDays,
  formatEnumValue,
  formatMinStake,
  formatNetworkName,
  formatOptionalDays,
  formatRewardClaiming,
  formatRewardRateLabel,
  formatRewardTokenLabel,
} from "../overview/earn-details/earn-details-formatters";

export type DashboardPositionStatusTone = "action" | "claim" | "default";

export type DashboardPositionMetricCard = {
  id: string;
  label: string;
  subValue?: string;
  tone?: DashboardPositionStatusTone;
  value: ReactNode;
};

export type DashboardPositionStatusSummary = {
  label: string;
  tone: DashboardPositionStatusTone;
  value: string;
} | null;

export type DashboardPositionBreakdownRow = {
  id: string;
  label: string;
  subValue?: string;
  value: string;
};

export type DashboardPositionDetailRow = {
  id: string;
  label: string;
  value: ReactNode;
};

export type DashboardPositionAddressRow = {
  address: string;
  label: string;
};

export type DashboardPositionChartSection = {
  id: string;
  title: string;
};

export type DashboardPositionDetailsModel = {
  addressRows: DashboardPositionAddressRow[];
  breakdownRows: DashboardPositionBreakdownRow[];
  chartSections: DashboardPositionChartSection[];
  detailRows: DashboardPositionDetailRow[];
  metricCards: DashboardPositionMetricCard[];
  providerName: string;
  statusSummary: DashboardPositionStatusSummary;
};

export type DashboardPositionPendingAction = {
  amount: BigNumber | null;
  formattedAmount: string;
  pendingActionDto: YieldPendingActionDto;
  yieldBalance: YieldBalanceDto;
};

type ProviderDetail = {
  address?: string;
  name?: string;
  rewardRate?: number | null;
  status?: string | null;
};

export const getDashboardPositionDetailsModel = ({
  canUnstake,
  integrationData,
  pendingActions,
  personalizedRewardRate,
  positionBalancesByType,
  providersDetails,
  reducedStakedOrLiquidBalance,
  rewardsSummary,
  t,
}: {
  canUnstake: boolean;
  integrationData: Yield;
  pendingActions: DashboardPositionPendingAction[];
  personalizedRewardRate?: YieldRewardRateDto | null;
  positionBalancesByType: PositionBalancesByType;
  providersDetails: ProviderDetail[];
  reducedStakedOrLiquidBalance: {
    amount: BigNumber;
    amountUsd: BigNumber;
    token: YieldBalanceDto["token"];
  } | null;
  rewardsSummary?: YieldRewardsSummaryResponseDto;
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
    positionBalancesByType,
    promotedFactIds,
    reducedStakedOrLiquidBalance,
    t,
  });
  const rewardsMetric = getRewardsMetric({
    pendingActions,
    positionBalancesByType,
    promotedFactIds,
    rewardsSummary,
    t,
  });
  const apyMetric = getApyMetric({
    integrationData,
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
      ? getFillerMetric({ integrationData, promotedFactIds, t })
      : null;

  return {
    addressRows: getAddressRows(integrationData, t),
    breakdownRows: getBreakdownRows({ positionBalancesByType, t }),
    chartSections: [],
    detailRows: getDetailRows({
      integrationData,
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
  promotedFactIds,
  t,
}: {
  integrationData: Yield;
  promotedFactIds: Set<string>;
  t: TFunction;
}): DashboardPositionMetricCard | null => {
  const cooldownDays = getYieldCooldownPeriod(integrationData)?.days ?? 0;

  if (cooldownDays > 0) {
    promotedFactIds.add("cooldown");

    return {
      id: "unstaking-period",
      label: t("dashboard.earn_details.cooldown"),
      value: t("dashboard.earn_details.cooldown_days", { count: cooldownDays }),
    };
  }

  const rewardToken = formatRewardTokenLabel(integrationData);

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
  integrationData: Yield;
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
  positionBalancesByType,
  promotedFactIds,
  reducedStakedOrLiquidBalance,
  t,
}: {
  positionBalancesByType: PositionBalancesByType;
  promotedFactIds: Set<string>;
  reducedStakedOrLiquidBalance: {
    amount: BigNumber;
    amountUsd: BigNumber;
    token: YieldBalanceDto["token"];
  } | null;
  t: TFunction;
}): DashboardPositionMetricCard | null => {
  if (reducedStakedOrLiquidBalance?.amount.isGreaterThan(0)) {
    promotedFactIds.add("balance");

    return {
      id: "balance",
      label: t("dashboard.position_details.balance"),
      subValue: formatUsdSubValue(reducedStakedOrLiquidBalance.amountUsd),
      value: `${defaultFormattedNumber(reducedStakedOrLiquidBalance.amount)} ${
        reducedStakedOrLiquidBalance.token.symbol
      }`,
    };
  }

  const totalUsd = getNonPointsBalances(positionBalancesByType).reduce(
    (acc, balance) => acc.plus(balance.amountUsd ?? 0),
    new BigNumber(0)
  );

  if (!totalUsd.isGreaterThan(0)) return null;

  promotedFactIds.add("balance");

  return {
    id: "balance",
    label: t("dashboard.position_details.balance"),
    value: formatUsdValue(totalUsd),
  };
};

const getRewardsMetric = ({
  pendingActions,
  positionBalancesByType,
  promotedFactIds,
  rewardsSummary,
  t,
}: {
  pendingActions: DashboardPositionPendingAction[];
  positionBalancesByType: PositionBalancesByType;
  promotedFactIds: Set<string>;
  rewardsSummary?: YieldRewardsSummaryResponseDto;
  t: TFunction;
}): DashboardPositionMetricCard | null => {
  const claimableBalance = getBalancesByPriority(positionBalancesByType)
    .filter(
      (balance) => balance.type === "claimable" && !balance.token.isPoints
    )
    .find((balance) => BigNumber(balance.amount).isGreaterThan(0));

  if (claimableBalance) {
    promotedFactIds.add("rewards");

    return {
      id: "rewards",
      label: t("dashboard.position_details.rewards"),
      subValue: formatUsdSubValue(claimableBalance.amountUsd),
      value: `${defaultFormattedNumber(claimableBalance.amount)} ${
        claimableBalance.token.symbol
      }`,
    };
  }

  if (
    rewardsSummary &&
    BigNumber(rewardsSummary.rewards.total).isGreaterThan(0)
  ) {
    promotedFactIds.add("rewards");

    return {
      id: "rewards",
      label: t("dashboard.position_details.rewards"),
      subValue: t("dashboard.position_details.rewards_total"),
      value: `${defaultFormattedNumber(rewardsSummary.rewards.total)} ${
        rewardsSummary.token.symbol
      }`,
    };
  }

  const claimAction = pendingActions.find(
    (action) => action.pendingActionDto.type === "CLAIM_REWARDS"
  );

  if (!claimAction) return null;

  promotedFactIds.add("rewards");

  return {
    id: "rewards",
    label: t("dashboard.position_details.rewards"),
    subValue: claimAction.formattedAmount || undefined,
    value: t("position_details.pending_action.claim_rewards"),
  };
};

const getApyMetric = ({
  integrationData,
  personalizedRewardRate,
  promotedFactIds,
  t,
}: {
  integrationData: Yield;
  personalizedRewardRate?: YieldRewardRateDto | null;
  promotedFactIds: Set<string>;
  t: TFunction;
}): DashboardPositionMetricCard | null => {
  const rewardRate =
    personalizedRewardRate?.total ?? integrationData.rewardRate.total;
  const amount = BigNumber(rewardRate);

  if (!amount.isFinite() || amount.isZero()) return null;

  promotedFactIds.add("apy");

  return {
    id: "apy",
    label: personalizedRewardRate
      ? t("position_details.personalized_apy")
      : formatRewardRateLabel(integrationData, t),
    value: `${APToPercentage(amount.toNumber())}%`,
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

  const [pendingAction] = pendingActions;

  if (pendingAction) {
    return {
      label: t("dashboard.position_details.action_required"),
      tone:
        pendingAction.pendingActionDto.type === "CLAIM_REWARDS"
          ? "claim"
          : "action",
      value: t(
        `position_details.pending_action.${
          pendingAction.pendingActionDto.type.toLowerCase() as Lowercase<
            YieldPendingActionDto["type"]
          >
        }`
      ),
    };
  }

  const statusBalance = getBalancesByPriority(positionBalancesByType).find(
    (balance) =>
      balance.type === "locked" ||
      balance.type === "claimable" ||
      balance.type === "withdrawable" ||
      balance.type === "exiting" ||
      balance.type === "entering"
  );

  if (statusBalance) {
    return {
      label:
        statusBalance.type === "claimable" ||
        statusBalance.type === "withdrawable"
          ? t("dashboard.position_details.action_available")
          : t("dashboard.position_details.status"),
      tone:
        statusBalance.type === "claimable" ||
        statusBalance.type === "withdrawable"
          ? "claim"
          : statusBalance.type === "locked"
            ? "action"
            : "default",
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

const getBreakdownRows = ({
  positionBalancesByType,
  t,
}: {
  positionBalancesByType: PositionBalancesByType;
  t: TFunction;
}): DashboardPositionBreakdownRow[] =>
  getBalancesByPriority(positionBalancesByType).map((balance, index) => ({
    id: `${balance.type}-${balance.token.symbol}-${index}`,
    label: formatBalanceTypeLabel(balance.type, t),
    subValue: balance.token.isPoints
      ? t("shared.points")
      : formatUsdSubValue(balance.amountUsd),
    value: `${defaultFormattedNumber(balance.amount)} ${balance.token.symbol}`,
  }));

const getDetailRows = ({
  integrationData,
  promotedFactIds,
  providerName,
  t,
}: {
  integrationData: Yield;
  promotedFactIds: Set<string>;
  providerName: string;
  t: TFunction;
}): DashboardPositionDetailRow[] => {
  const risk = getYieldRiskDisplay(integrationData);
  const minStake = formatMinStake(integrationData, t);
  const cooldown = formatCooldownDays(
    getYieldCooldownPeriod(integrationData)?.days ?? 0,
    t
  );
  const warmup = formatOptionalDays(
    getYieldWarmupPeriod(integrationData)?.days,
    t
  );
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
          value: formatRewardTokenLabel(integrationData),
        },
    {
      id: "type",
      label: t("dashboard.earn_details.type"),
      value: getYieldTypeLabels(integrationData, t).title,
    },
    {
      id: "reward-schedule",
      label: t("dashboard.earn_details.reward_schedule"),
      value: formatEnumValue(integrationData.mechanics.rewardSchedule),
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
          value: `${APToPercentage(integrationData.rewardRate.total)}%`,
        },
    minStake
      ? {
          id: "min-stake",
          label: t("dashboard.earn_details.min_stake"),
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
          value: (
            <div className={riskSummaryActions}>
              <RiskRatingBadge risk={risk} />
              <YieldRiskInfoTooltip />
            </div>
          ),
        }
      : null,
  ];

  return rows.filter((row): row is DashboardPositionDetailRow => !!row);
};

const getAddressRows = (
  integrationData: Yield,
  t: TFunction
): DashboardPositionAddressRow[] =>
  [
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
  ].filter((row): row is DashboardPositionAddressRow => !!row);

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

const formatUsdSubValue = (
  value: string | number | BigNumber | null | undefined
) => {
  if (value == null) return undefined;

  const amount = BigNumber(value);

  return amount.isGreaterThan(0) ? formatUsdValue(amount) : undefined;
};

const formatUsdValue = (value: BigNumber) =>
  `$${defaultFormattedNumber(value)}`;

export const getPositionHeaderBadges = (
  integrationData: Yield,
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
