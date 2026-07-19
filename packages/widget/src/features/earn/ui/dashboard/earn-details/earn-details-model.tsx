import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import type { EarnYieldWithProvider } from "../../../../../domain/schema/earn-models";
import {
  getEffectiveYieldRewardRateDetails,
  type SelectedValidators,
} from "../../../../../domain/types/reward-rate";
import {
  getDashboardYieldCategory,
  getExtendedYieldType,
  getYieldCooldownPeriod,
  getYieldFeePercent,
  getYieldLockupPeriod,
  getYieldRiskDisplay,
  getYieldRiskSourceLabel,
  getYieldTvlUsd,
  getYieldTypeLabels,
  getYieldWarmupPeriod,
} from "../../../../../domain/types/yields";
import type { DashboardYieldCategory } from "../../../../../public-api/types";
import { formatCompactUsd } from "../../../../../shared/lib/formatters";
import { APToPercentage } from "../../../../../shared/lib/general";
import { Box } from "../../../../../shared/ui/primitives/box";
import {
  RiskRatingBadge,
  YieldRiskInfoTooltip,
} from "../../components/yield-risk";
import { riskSummaryActions } from "../../components/yield-risk/styles.css";
import { NetworkDetailValue } from "./components/network-detail-value";
import {
  formatCooldownDays,
  formatEnumValue,
  formatMeaningfulCompactNumber,
  formatMeaningfulCompactUsd,
  formatMinStake,
  formatMinStakeLabel,
  formatNetworkName,
  formatOptionalDays,
  formatPricePerShare,
  formatRequirementStatus,
  formatRewardClaiming,
  formatRewardRate,
  formatRewardRateLabel,
  formatRewardTokenLabel,
} from "./earn-details-formatters";

export type EarnDetailsMetricCard = {
  label: string;
  subValue?: string;
  value: ReactNode;
};

export type EarnDetailRow = {
  id: string;
  label: string;
  value: ReactNode;
};

export type EarnDetailAddressRow = {
  address: string;
  label: string;
};

export type EarnDetailsHeaderBadge = {
  label: string;
  tone: "default" | "auto";
};

type EarnDetailFactId =
  | "reward-rate"
  | "risk"
  | "min-stake"
  | "cooldown"
  | "warmup"
  | "lockup"
  | "withdrawal"
  | "tvl"
  | "fees"
  | "status"
  | "average-position"
  | "users"
  | "type"
  | "reward-schedule"
  | "reward-claiming";

type EarnDetailFact = {
  detailEligible: boolean;
  id: EarnDetailFactId;
  kpiEligible: boolean;
  kpiPrimaryEligible: boolean;
  label: string;
  subValue?: string;
  value: ReactNode;
};

const kpiPriorities = {
  stake: [
    "reward-rate",
    "min-stake",
    "cooldown",
    "warmup",
    "lockup",
    "withdrawal",
    "risk",
  ],
  defi: [
    "reward-rate",
    "tvl",
    "fees",
    "withdrawal",
    "status",
    "average-position",
    "users",
    "risk",
  ],
  rwa: [
    "reward-rate",
    "status",
    "tvl",
    "average-position",
    "users",
    "lockup",
    "risk",
  ],
} as const satisfies Record<
  Exclude<DashboardYieldCategory, null>,
  readonly EarnDetailFactId[]
>;

const maxMetricCards = 3;

export const getEarnDetailsModel = ({
  selectedValidators,
  t,
  yieldDto,
}: {
  selectedValidators?: SelectedValidators | null;
  t: TFunction;
  yieldDto: EarnYieldWithProvider;
}) => {
  const provider = yieldDto.provider;
  const dashboardYieldCategory = getDashboardYieldCategory(yieldDto);
  const effectiveRewardRate = getEffectiveYieldRewardRateDetails({
    selectedValidators,
    yieldDto,
  });
  const detailFacts = getEarnDetailFacts({
    effectiveRewardRate,
    provider,
    t,
    yieldDto,
  });
  const promotedFactIds = getPromotedFactIds(
    detailFacts,
    dashboardYieldCategory
  );

  return {
    addressRows: getAddressRows(yieldDto, t),
    dashboardYieldCategory,
    detailRows: getDetailRows({
      facts: detailFacts,
      promotedFactIds,
      t,
      yieldDto,
    }),
    headerBadges: getHeaderBadges(yieldDto, t),
    isStakeCategory: dashboardYieldCategory === "stake",
    metricCards: detailFacts
      .filter((fact) => promotedFactIds.has(fact.id))
      .map(toMetricCard),
    providerName: getSelectedProviderName({
      selectedValidators,
      yieldDto,
    }),
    rewardRateFormatted: formatRewardRate(effectiveRewardRate, yieldDto) ?? "-",
    tvlChartValue: formatCompactUsd(yieldDto.statistics?.tvlUsd),
  };
};

const getPromotedFactIds = (
  facts: EarnDetailFact[],
  category: DashboardYieldCategory | null
): Set<EarnDetailFactId> => {
  const priority = category ? kpiPriorities[category] : kpiPriorities.defi;
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));
  const orderedFacts = priority.flatMap((id) => {
    const fact = factsById.get(id);

    return fact?.kpiEligible ? [fact] : [];
  });
  const primaryFacts = orderedFacts
    .filter((fact) => fact.kpiPrimaryEligible)
    .slice(0, maxMetricCards);
  const primaryFactIds = new Set(primaryFacts.map((fact) => fact.id));
  const fallbackFacts = orderedFacts
    .filter((fact) => !primaryFactIds.has(fact.id))
    .slice(0, maxMetricCards - primaryFacts.length);

  return new Set([...primaryFacts, ...fallbackFacts].map((fact) => fact.id));
};

const toMetricCard = (fact: EarnDetailFact): EarnDetailsMetricCard => ({
  label: fact.label,
  subValue: fact.subValue,
  value: fact.value,
});

const getEarnDetailFacts = ({
  effectiveRewardRate,
  provider,
  t,
  yieldDto,
}: {
  effectiveRewardRate: ReturnType<typeof getEffectiveYieldRewardRateDetails>;
  provider: EarnYieldWithProvider["provider"];
  t: TFunction;
  yieldDto: EarnYieldWithProvider;
}) =>
  [
    getRewardRateFact({ effectiveRewardRate, t, yieldDto }),
    getRiskFact(yieldDto, t),
    getMinStakeFact(yieldDto, t),
    getCooldownFact(yieldDto, t),
    getWarmupFact(yieldDto, t),
    getLockupFact(yieldDto, t),
    getWithdrawalFact(yieldDto, t),
    getTvlFact(yieldDto, t),
    getFeesFact(yieldDto, t),
    getStatusFact({ provider, t, yieldDto }),
    getAveragePositionFact(yieldDto, t),
    getUsersFact(yieldDto, t),
    getTypeFact(yieldDto, t),
    getRewardScheduleFact(yieldDto, t),
    getRewardClaimingFact({ t, yieldDto }),
  ].filter((fact): fact is EarnDetailFact => !!fact);

const getDetailRows = ({
  facts,
  promotedFactIds,
  t,
  yieldDto,
}: {
  facts: EarnDetailFact[];
  promotedFactIds: Set<EarnDetailFactId>;
  t: TFunction;
  yieldDto: EarnYieldWithProvider;
}): EarnDetailRow[] => [
  {
    id: "network",
    label: t("dashboard.earn_details.network"),
    value: <NetworkDetailValue network={yieldDto.network} />,
  },
  {
    id: "provider",
    label: t("dashboard.earn_details.provider"),
    value: yieldDto.provider?.name ?? yieldDto.providerId,
  },
  {
    id: "reward-token",
    label: t("dashboard.earn_details.reward_token"),
    value: formatRewardTokenLabel(yieldDto, t),
  },
  ...getPricePerShareRows(yieldDto, t),
  ...facts
    .filter((fact) => fact.detailEligible && !promotedFactIds.has(fact.id))
    .map((fact) => ({
      id: fact.id,
      label: fact.label,
      value: fact.value,
    })),
];

const getPricePerShareRows = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailRow[] => {
  const value = formatPricePerShare(yieldDto);

  if (!value) return [];

  return [
    {
      id: "price-per-share",
      label: t("dashboard.earn_details.price_per_share"),
      value,
    },
  ];
};

const getRewardRateFact = ({
  effectiveRewardRate,
  t,
  yieldDto,
}: {
  effectiveRewardRate: ReturnType<typeof getEffectiveYieldRewardRateDetails>;
  t: TFunction;
  yieldDto: EarnYieldWithProvider;
}): EarnDetailFact | null => {
  const value = formatRewardRate(effectiveRewardRate, yieldDto);

  if (!value) return null;

  return {
    detailEligible: true,
    id: "reward-rate",
    kpiEligible: true,
    kpiPrimaryEligible: true,
    label: formatRewardRateLabel(yieldDto, t),
    value,
  };
};

const getRiskFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailFact | null => {
  const risk = getYieldRiskDisplay(yieldDto);

  if (!risk) return null;

  return {
    detailEligible: true,
    id: "risk",
    kpiEligible: true,
    kpiPrimaryEligible: true,
    label: t("dashboard.earn_details.risk"),
    subValue: getYieldRiskSourceLabel(risk.source, t).toUpperCase(),
    value: (
      <Box className={riskSummaryActions}>
        <RiskRatingBadge risk={risk} />
        <YieldRiskInfoTooltip />
      </Box>
    ),
  };
};

const getMinStakeFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailFact | null => {
  const value = formatMinStake(yieldDto, t);

  if (!value) return null;

  return {
    detailEligible: true,
    id: "min-stake",
    kpiEligible: true,
    kpiPrimaryEligible: value.kpiPrimaryEligible,
    label: formatMinStakeLabel(yieldDto, t),
    value: value.value,
  };
};

const getCooldownFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailFact => {
  const days = getYieldCooldownPeriod(yieldDto)?.days ?? 0;

  return {
    detailEligible: true,
    id: "cooldown",
    kpiEligible: true,
    kpiPrimaryEligible: days > 0,
    label: t("dashboard.earn_details.cooldown"),
    value: formatCooldownDays(days, t),
  };
};

const getWarmupFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailFact | null => {
  const value = formatOptionalDays(getYieldWarmupPeriod(yieldDto)?.days, t);

  if (!value) return null;

  return {
    detailEligible: true,
    id: "warmup",
    kpiEligible: true,
    kpiPrimaryEligible: true,
    label: t("dashboard.earn_details.warmup"),
    value,
  };
};

const getLockupFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailFact | null => {
  const value = formatOptionalDays(getYieldLockupPeriod(yieldDto)?.days, t);

  if (!value) return null;

  return {
    detailEligible: true,
    id: "lockup",
    kpiEligible: true,
    kpiPrimaryEligible: true,
    label: t("dashboard.earn_details.lockup"),
    value,
  };
};

const getWithdrawalFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailFact => ({
  detailEligible: true,
  id: "withdrawal",
  kpiEligible: true,
  kpiPrimaryEligible: true,
  label: t("dashboard.earn_details.withdrawal"),
  value: yieldDto.status.exit
    ? t("dashboard.earn_details.available")
    : t("dashboard.earn_details.unavailable"),
});

const getTvlFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailFact | null => {
  const value = formatMeaningfulCompactUsd(getYieldTvlUsd(yieldDto));

  if (!value) return null;

  return {
    detailEligible: true,
    id: "tvl",
    kpiEligible: true,
    kpiPrimaryEligible: true,
    label: t("dashboard.earn_details.tvl"),
    value,
  };
};

const getFeesFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailFact | null => {
  const fee = getYieldFeePercent(yieldDto);

  if (fee === null) return null;

  return {
    detailEligible: true,
    id: "fees",
    kpiEligible: true,
    kpiPrimaryEligible: true,
    label: t("shared.fees"),
    value: `${APToPercentage(fee)}%`,
  };
};

const getStatusFact = ({
  provider,
  t,
  yieldDto,
}: {
  provider: EarnYieldWithProvider["provider"];
  t: TFunction;
  yieldDto: EarnYieldWithProvider;
}): EarnDetailFact => ({
  detailEligible: true,
  id: "status",
  kpiEligible: true,
  kpiPrimaryEligible: true,
  label: t("dashboard.earn_details.status"),
  subValue: provider?.name ?? formatNetworkName(yieldDto.network).toUpperCase(),
  value: formatRequirementStatus(yieldDto, t),
});

const getAveragePositionFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailFact | null => {
  const value = formatMeaningfulCompactUsd(
    yieldDto.statistics?.averagePositionSizeUsd
  );

  if (!value) return null;

  return {
    detailEligible: true,
    id: "average-position",
    kpiEligible: true,
    kpiPrimaryEligible: true,
    label: t("dashboard.earn_details.average_position"),
    value,
  };
};

const getUsersFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailFact | null => {
  const value = formatMeaningfulCompactNumber(yieldDto.statistics?.uniqueUsers);

  if (!value) return null;

  return {
    detailEligible: true,
    id: "users",
    kpiEligible: true,
    kpiPrimaryEligible: true,
    label: t("dashboard.earn_details.users"),
    value,
  };
};

const getTypeFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailFact => ({
  detailEligible: true,
  id: "type",
  kpiEligible: false,
  kpiPrimaryEligible: false,
  label: t("dashboard.earn_details.type"),
  value: getYieldTypeLabels(yieldDto, t).title,
});

const getRewardScheduleFact = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailFact => ({
  detailEligible: true,
  id: "reward-schedule",
  kpiEligible: false,
  kpiPrimaryEligible: false,
  label: t("dashboard.earn_details.reward_schedule"),
  value: formatEnumValue(yieldDto.mechanics.rewardSchedule),
});

const getRewardClaimingFact = ({
  t,
  yieldDto,
}: {
  t: TFunction;
  yieldDto: EarnYieldWithProvider;
}): EarnDetailFact => ({
  detailEligible: true,
  id: "reward-claiming",
  kpiEligible: false,
  kpiPrimaryEligible: false,
  label: t("dashboard.earn_details.reward_claiming"),
  value: formatRewardClaiming(yieldDto, t),
});

const getSelectedProviderName = ({
  selectedValidators,
  yieldDto,
}: {
  selectedValidators?: SelectedValidators | null;
  yieldDto: EarnYieldWithProvider;
}) => {
  const selectedValidatorsArr = selectedValidators
    ? [...selectedValidators.values()]
    : [];

  if (selectedValidatorsArr.length) {
    return selectedValidatorsArr
      .map((validator) => validator.name ?? validator.address)
      .join(", ");
  }

  return yieldDto.provider?.name ?? yieldDto.providerId;
};

const getHeaderBadges = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailsHeaderBadge[] => {
  const yieldType = getExtendedYieldType(yieldDto);
  const badges: EarnDetailsHeaderBadge[] = [];

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

  if (yieldType === "restaking") {
    badges.push({
      label: t("yield_types.restaking.title"),
      tone: "default",
    });
  }

  if (yieldDto.mechanics.requirements?.kycRequired) {
    badges.push({
      label: t("dashboard.earn_details.kyc"),
      tone: "default",
    });
  }

  if (
    getDashboardYieldCategory(yieldDto) === "stake" &&
    yieldDto.mechanics.rewardClaiming === "auto"
  ) {
    badges.push({
      label: t("dashboard.earn_details.auto_compound"),
      tone: "auto",
    });
  }

  return badges;
};

const getAddressRows = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): EarnDetailAddressRow[] => {
  const rows: Array<EarnDetailAddressRow | null> = [
    yieldDto.outputToken?.address
      ? {
          label: t("dashboard.earn_details.vault"),
          address: yieldDto.outputToken.address,
        }
      : null,
    yieldDto.token.address
      ? {
          label: t("dashboard.earn_details.asset", {
            symbol: yieldDto.token.symbol,
          }),
          address: yieldDto.token.address,
        }
      : null,
  ];

  return rows.filter((row): row is EarnDetailAddressRow => row !== null);
};
