import type { YieldRiskDisplay } from "../../../domain/earn/yield";
import type { Tone } from "../../../ui/index";

// Green stays for positive rates, so the best ratings read in the info tone.
const riskTones = {
  positive: "info",
  warning: "warning",
  danger: "danger",
  neutral: "neutral",
} as const satisfies Record<YieldRiskDisplay["tone"], Tone>;

/** The tone a rating reads in, wherever it shows, such as a picker's badge. */
export const getRiskRatingTone = (risk: YieldRiskDisplay): Tone =>
  riskTones[risk.tone];
