import type { TFunction } from "i18next";
import type { ReactNode } from "react";

import type { YieldCategory } from "../../../../../domain/earn/contract";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import type { SelectedValidators } from "../../../../../domain/earn/reward-rate";
import {
  getExtendedYieldType,
  getYieldCategory,
  isYieldValidatorSelectionRequired,
} from "../../../../../domain/earn/yield";
import {
  getYieldFacts,
  getYieldFigures,
  type YieldFact,
  type YieldFactId,
} from "../../../../yield-summary/index";
import { YieldFactValue } from "../../../../yield-summary/views";

export type EarnDetailsMetricCard = {
  label: string;
  subValue?: string;
  value: ReactNode;
};

export type EarnDetailsHeaderBadge = {
  label: string;
  tone: "default" | "auto";
};

/** The facts a category's metric cards lead with, in order of priority. */
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
    "withdrawal",
    "status",
    "average-position",
    "risk",
  ],
  rwa: ["reward-rate", "status", "tvl", "average-position", "lockup", "risk"],
} as const satisfies Record<
  Exclude<YieldCategory, null>,
  readonly YieldFactId[]
>;

const maxMetricCards = 3;

export const canPresentRewardRateHistory = (yieldDto: EarnYieldWithProvider) =>
  !isYieldValidatorSelectionRequired(yieldDto);

/**
 * The Earn details pane: the facts its metric cards lead with, and the facts
 * its yield-facts section leaves out because the metric cards show them
 * already.
 */
export const getEarnDetailsModel = ({
  locale,
  selectedValidators = null,
  t,
  yieldDto,
}: {
  locale: string;
  selectedValidators?: SelectedValidators | null;
  t: TFunction;
  yieldDto: EarnYieldWithProvider;
}) => {
  const yieldCategory = getYieldCategory(yieldDto);
  const facts = getYieldFacts({ locale, selectedValidators, t, yieldDto });
  const promotedFacts = getPromotedFacts(facts, yieldCategory);

  return {
    figures: getYieldFigures({ locale, selectedValidators, t, yieldDto }),
    headerBadges: getHeaderBadges(yieldDto, t),
    isStakeCategory: yieldCategory === "stake",
    metricCards: promotedFacts.map(toMetricCard),
    omittedYieldFacts: promotedFacts.map(
      (fact) => fact.id
    ) satisfies YieldFactId[],
    providerName: getSelectedProviderName({
      selectedValidators,
      yieldDto,
    }),
  };
};

/**
 * Up to three facts in the category's priority, notable ones first, kept in
 * the yield's own fact order.
 */
const getPromotedFacts = (
  facts: ReadonlyArray<YieldFact>,
  category: YieldCategory | null
): YieldFact[] => {
  const priority: ReadonlyArray<YieldFactId> = category
    ? kpiPriorities[category]
    : kpiPriorities.defi;
  const factsById = new Map(facts.map((fact) => [fact.id, fact]));
  const orderedFacts = priority.flatMap((id) => {
    const fact = factsById.get(id);

    return fact ? [fact] : [];
  });
  const primaryFacts = orderedFacts
    .filter((fact) => fact.notable)
    .slice(0, maxMetricCards);
  const primaryFactIds = new Set(primaryFacts.map((fact) => fact.id));
  const fallbackFacts = orderedFacts
    .filter((fact) => !primaryFactIds.has(fact.id))
    .slice(0, maxMetricCards - primaryFacts.length);
  const promotedIds = new Set(
    [...primaryFacts, ...fallbackFacts].map((fact) => fact.id)
  );

  return facts.filter((fact) => promotedIds.has(fact.id));
};

const toMetricCard = (fact: YieldFact): EarnDetailsMetricCard => ({
  label: fact.label,
  ...(fact.subValue === undefined ? {} : { subValue: fact.subValue }),
  value: <YieldFactValue value={fact.value} />,
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
    getYieldCategory(yieldDto) === "stake" &&
    yieldDto.mechanics.rewardClaiming === "auto"
  ) {
    badges.push({
      label: t("dashboard.earn_details.auto_compound"),
      tone: "auto",
    });
  }

  return badges;
};
