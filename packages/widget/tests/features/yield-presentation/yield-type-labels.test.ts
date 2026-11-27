import { describe, expect, it } from "vitest";

import type { EarnYieldWithProvider } from "../../../src/domain/earn/yield-schema";
import {
  getRiskRatingTone,
  getYieldRiskSourceLabel,
  getYieldTypeLabels,
} from "../../../src/features/yield-presentation/index";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";

const i18n = createWidgetI18nInstance();
const en = i18n.getFixedT("en");
const fr = i18n.getFixedT("fr");

const makeYield = (type: string): EarnYieldWithProvider =>
  ({
    mechanics: { type },
    token: { network: "ethereum", symbol: "USDC" },
  }) as EarnYieldWithProvider;

describe("getYieldTypeLabels", () => {
  it("uses liquid staking copy for liquid_staking", () => {
    expect(getYieldTypeLabels(makeYield("liquid_staking"), en)).toEqual({
      title: "Liquid staking",
      review: "Liquid staking",
      cta: "Stake",
    });
  });

  it("translates the generic copy of unknown runtime yield types", () => {
    expect(getYieldTypeLabels(makeYield("future_yield_type"), en)).toEqual({
      title: "Yield",
      review: "Earn",
      cta: "Earn",
    });
    expect(getYieldTypeLabels(makeYield("future_yield_type"), fr)).toEqual({
      title: "Rendement",
      review: "Gagner",
      cta: "Gagner",
    });
  });
});

describe("getRiskRatingTone", () => {
  it.each([
    ["A+", "info"],
    [" b ", "warning"],
    ["CCC", "danger"],
    ["F", "danger"],
    ["NR", "neutral"],
  ] as const)("reads %s in the %s tone", (rating, tone) => {
    expect(getRiskRatingTone({ rating, score: null, source: "credora" })).toBe(
      tone
    );
  });
});

describe("getYieldRiskSourceLabel", () => {
  it("names known raters and keeps an unknown rater's ID", () => {
    expect(getYieldRiskSourceLabel("credora", en)).toBe(
      en("details.risk.sources.credora")
    );
    expect(getYieldRiskSourceLabel("someRater", en)).toBe("someRater");
  });
});
