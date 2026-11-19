import type { TFunction } from "i18next";

import type { YieldRiskDisplay } from "../../../domain/earn/yield";
import type { Tone } from "../../../ui/index";

/**
 * The tone a rating reads in, wherever it shows, such as a picker's badge:
 * its letter band, A best. Green stays for positive rates, so the best
 * ratings read in the info tone; a rating outside the bands is neutral.
 */
export const getRiskRatingTone = (risk: YieldRiskDisplay): Tone => {
  const rating = risk.rating.trim().toUpperCase();

  if (rating.startsWith("A")) return "info";
  if (rating.startsWith("B")) return "warning";
  if (["C", "D", "E", "F"].some((prefix) => rating.startsWith(prefix))) {
    return "danger";
  }

  return "neutral";
};

/** The rater's name: a known rater's translated name, otherwise its ID. */
export const getYieldRiskSourceLabel = (
  source: YieldRiskDisplay["source"],
  t: TFunction
): string => {
  switch (source) {
    case "credora":
      return t("details.risk.sources.credora");
    case "stakingRewards":
      return t("details.risk.sources.staking_rewards");
    default:
      return source;
  }
};
