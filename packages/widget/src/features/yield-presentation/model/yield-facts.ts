import type { DateTime } from "effect";
import type { TFunction } from "i18next";

import { isConfidentialYield } from "../../../domain/earn/confidential";
import type { SelectedValidators } from "../../../domain/earn/reward-rate";
import {
  getYieldCooldownPeriod,
  getYieldLockupPeriod,
  getYieldRiskDisplay,
  getYieldRiskSourceLabel,
  getYieldTypeLabels,
  getYieldWarmupPeriod,
  type YieldRiskDisplay,
} from "../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import type { Token } from "../../../domain/token/token";
import {
  formatNetworkName,
  humanizeEnumValue,
} from "../../../shared/lib/formatters";
import { formatRoundedPercent } from "../../../shared/lib/number-format";
import {
  formatDailyBatch,
  formatNextBatchLabel,
  formatNextBatchTiming,
} from "./next-batch";
import {
  formatCooldownDays,
  formatMeaningfulCompactUsd,
  formatMinStake,
  formatMinStakeLabel,
  formatOptionalDays,
  formatPricePerShare,
  formatProviderWebsite,
  formatProviderWebsiteHref,
  formatRequirementStatus,
  formatRewardClaiming,
  formatRewardTokenLabel,
} from "./yield-details-formatters";
import { getYieldFigures } from "./yield-figures";

export type YieldFactId =
  | "reward-rate"
  | "reward-token"
  | "price-per-share"
  | "risk"
  | "min-stake"
  | "cooldown"
  | "warmup"
  | "lockup"
  | "withdrawal"
  | "tvl"
  | "deposit-fee"
  | "withdrawal-fee"
  | "management-fee"
  | "performance-fee"
  | "status"
  | "average-position"
  | "type"
  | "reward-schedule"
  | "reward-claiming"
  | "website";

export type YieldFactValue =
  | string
  | Readonly<{
      readonly _tag: "Risk";
      readonly risk: YieldRiskDisplay;
    }>
  | Readonly<{
      readonly _tag: "Link";
      readonly href: string;
      readonly label: string;
    }>;

/** One thing true of a yield, whoever holds it. */
export type YieldFact = Readonly<{
  readonly id: YieldFactId;
  readonly label: string;
  /** A line under the value where the fact stands as a figure on its own. */
  readonly subValue?: string;
  readonly value: YieldFactValue;
  /** The token the value names, whose logo leads it. */
  readonly token?: Token;
  /** Explains the fact, behind an info button beside its value. */
  readonly info?: Readonly<{
    /** Names the info button, such as "About Deposit fee". */
    readonly label: string;
    readonly text: string;
  }>;
  /**
   * Whether the fact says more than the default, such as a minimum or a
   * cooldown that is not zero; a page leading with a few figures picks these.
   */
  readonly notable: boolean;
}>;

/** A contract of the yield the user can copy. */
export type YieldContract = Readonly<{
  readonly address: string;
  readonly label: string;
}>;

/**
 * The yield's facts, in the order its pages list them: the Earn pane and a
 * position's page both read them here. The rate is the selected validators'
 * when any are selected. With presentation time, a batched vault's cooldown
 * reads as its next batch.
 */
export const getYieldFacts = ({
  locale,
  now = null,
  selectedValidators = null,
  t,
  yieldDto,
}: {
  readonly locale: string;
  readonly now?: DateTime.Utc | null;
  readonly selectedValidators?: SelectedValidators | null;
  readonly t: TFunction;
  readonly yieldDto: EarnYieldWithProvider;
}): YieldFact[] => {
  const figures = getYieldFigures({ locale, selectedValidators, t, yieldDto });
  const risk = getYieldRiskDisplay(yieldDto);
  const minStake = formatMinStake(yieldDto, t, locale);
  const pricePerShare = formatPricePerShare(yieldDto, locale);
  const lockup = formatOptionalDays(getYieldLockupPeriod(yieldDto)?.days, t);
  const averagePosition = formatMeaningfulCompactUsd(
    yieldDto.statistics?.averagePositionSizeUsd,
    locale
  );
  const website = yieldDto.provider?.website;

  const facts: Array<YieldFact | null> = [
    figures.rate && {
      id: "reward-rate",
      label: figures.rate.label,
      notable: true,
      value: figures.rate.value,
    },
    {
      id: "reward-token",
      label: t("dashboard.earn_details.reward_token"),
      notable: false,
      token: yieldDto.outputToken ?? yieldDto.token,
      value: formatRewardTokenLabel(yieldDto, t),
    },
    pricePerShare
      ? {
          id: "price-per-share",
          label: t("dashboard.earn_details.price_per_share"),
          notable: false,
          value: pricePerShare,
        }
      : null,
    risk
      ? {
          id: "risk",
          label: t("dashboard.earn_details.risk"),
          notable: true,
          subValue: getYieldRiskSourceLabel(risk.source, t).toUpperCase(),
          value: { _tag: "Risk", risk },
        }
      : null,
    minStake
      ? {
          id: "min-stake",
          label: formatMinStakeLabel(yieldDto, t),
          notable: minStake.kpiPrimaryEligible,
          value: minStake.value,
        }
      : null,
    getCooldownFact({ now, t, yieldDto }),
    getWarmupFact({ t, yieldDto }),
    lockup
      ? {
          id: "lockup",
          label: t("dashboard.earn_details.lockup"),
          notable: true,
          value: lockup,
        }
      : null,
    {
      id: "withdrawal",
      label: t("dashboard.earn_details.withdrawal"),
      notable: true,
      value: yieldDto.status.exit
        ? t("dashboard.earn_details.available")
        : t("dashboard.earn_details.unavailable"),
    },
    figures.tvl && {
      id: "tvl",
      label: t("dashboard.earn_details.tvl"),
      notable: true,
      ...(figures.tvl.token === null ? {} : { subValue: figures.tvl.token }),
      value: figures.tvl.usd,
    },
    ...getFeeFacts({ locale, t, yieldDto }),
    {
      id: "status",
      label: t("dashboard.earn_details.status"),
      notable: true,
      subValue:
        yieldDto.provider?.name ??
        formatNetworkName(yieldDto.network).toUpperCase(),
      value: formatRequirementStatus(yieldDto, t),
    },
    averagePosition
      ? {
          id: "average-position",
          label: t("dashboard.earn_details.average_position"),
          notable: true,
          value: averagePosition,
        }
      : null,
    {
      id: "type",
      label: t("dashboard.earn_details.type"),
      notable: false,
      value: getYieldTypeLabels(yieldDto, t).title,
    },
    {
      id: "reward-schedule",
      label: t("dashboard.earn_details.reward_schedule"),
      notable: false,
      value: humanizeEnumValue(yieldDto.mechanics.rewardSchedule),
    },
    {
      id: "reward-claiming",
      label: t("dashboard.earn_details.reward_claiming"),
      notable: false,
      value: formatRewardClaiming(yieldDto, t),
    },
    website
      ? {
          id: "website",
          label: t("details.validators_website"),
          notable: false,
          value: {
            _tag: "Link",
            href: formatProviderWebsiteHref(website),
            label: formatProviderWebsite(website),
          },
        }
      : null,
  ];

  return facts.filter((fact): fact is YieldFact => !!fact);
};

/** Each fee type, and the basis its percent reads on. */
const feeBases = {
  deposit: null,
  withdrawal: null,
  management: "dashboard.earn_details.fee_per_year",
  performance: "dashboard.earn_details.fee_of_earnings",
} as const;

const feeTypes = [
  "deposit",
  "withdrawal",
  "management",
  "performance",
] as const;

/**
 * One fact per fee the yield charges, each on its own basis: deposit and
 * withdrawal fees of the amount moved, the management fee yearly, the
 * performance fee of earnings. Labels and explanations match the Review's.
 */
const getFeeFacts = ({
  locale,
  t,
  yieldDto,
}: {
  readonly locale: string;
  readonly t: TFunction;
  readonly yieldDto: EarnYieldWithProvider;
}): YieldFact[] =>
  feeTypes.flatMap((type): YieldFact[] => {
    const percentage = yieldDto.mechanics.fee?.[type];
    if (percentage == null || !percentage.isGreaterThan(0)) return [];
    const fee = formatRoundedPercent(percentage.dividedBy(100), locale);
    const basis = feeBases[type];
    const label = t(`review.${type}_fee`);

    return [
      {
        id: `${type}-fee`,
        info: {
          label: t("review.fee_info", { fee: label }),
          text: t(`review.${type}_fee_explanation`),
        },
        label,
        notable: true,
        value: basis === null ? fee : t(basis, { fee }),
      },
    ];
  });

/**
 * When withdrawals pay out: a batched vault's next batch with presentation
 * time, else its daily batch, else the yield's cooldown. A confidential vault
 * states only its published next batch: its balances settle in the batch the
 * API assigns.
 */
const getCooldownFact = ({
  now,
  t,
  yieldDto,
}: {
  readonly now: DateTime.Utc | null;
  readonly t: TFunction;
  readonly yieldDto: EarnYieldWithProvider;
}): YieldFact | null => {
  const label = t("dashboard.earn_details.cooldown");
  const nextBatch = formatNextBatchTiming({
    now,
    side: "redemption",
    t,
    yieldDto,
  });
  if (nextBatch) {
    return {
      id: "cooldown",
      label,
      notable: true,
      value: formatNextBatchLabel(nextBatch, t),
    };
  }
  if (isConfidentialYield(yieldDto)) return null;
  const dailyBatch = formatDailyBatch({ side: "redemption", t, yieldDto });
  const days = getYieldCooldownPeriod(yieldDto)?.days ?? 0;

  return {
    id: "cooldown",
    label,
    notable: !!dailyBatch || days > 0,
    value: dailyBatch ?? formatCooldownDays(days, t),
  };
};

const getWarmupFact = ({
  t,
  yieldDto,
}: {
  readonly t: TFunction;
  readonly yieldDto: EarnYieldWithProvider;
}): YieldFact | null => {
  if (isConfidentialYield(yieldDto)) return null;
  const value =
    formatDailyBatch({ side: "subscription", t, yieldDto }) ??
    formatOptionalDays(getYieldWarmupPeriod(yieldDto)?.days, t);

  return value
    ? {
        id: "warmup",
        label: t("dashboard.earn_details.warmup"),
        notable: true,
        value,
      }
    : null;
};

/** The yield's vault and asset contracts. */
export const getYieldContracts = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): YieldContract[] => [
  ...(yieldDto.outputToken?.address
    ? [
        {
          label: t("dashboard.earn_details.vault"),
          address: yieldDto.outputToken.address,
        },
      ]
    : []),
  ...(yieldDto.token.address
    ? [
        {
          label: t("dashboard.earn_details.asset", {
            symbol: yieldDto.token.symbol,
          }),
          address: yieldDto.token.address,
        },
      ]
    : []),
];
