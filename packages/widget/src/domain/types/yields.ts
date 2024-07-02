import type { YieldType } from "@stakekit/api-hooks";
import type { useTranslation } from "react-i18next";

export const getYieldTypesMap = (
  translation: ReturnType<typeof useTranslation>["t"]
): {
  [key in YieldType]: { type: key; title: string; review: string; cta: string };
} =>
  ({
    staking: {
      type: "staking",
      title: translation("yield_types.staking.title"),
      review: translation("yield_types.staking.review"),
      cta: translation("yield_types.staking.cta"),
    },
    "liquid-staking": {
      type: "liquid-staking",
      title: translation("yield_types.liquid-staking.title"),
      review: translation("yield_types.liquid-staking.review"),
      cta: translation("yield_types.liquid-staking.cta"),
    },
    vault: {
      type: "vault",
      title: translation("yield_types.vault.title"),
      review: translation("yield_types.vault.review"),
      cta: translation("yield_types.vault.cta"),
    },
    lending: {
      type: "lending",
      title: translation("yield_types.lending.title"),
      review: translation("yield_types.lending.review"),
      cta: translation("yield_types.lending.cta"),
    },
    restaking: {
      type: "restaking",
      title: translation("yield_types.restaking.title"),
      review: translation("yield_types.restaking.review"),
      cta: translation("yield_types.restaking.cta"),
    },
  }) as const;

export const yieldTypesSortRank: { [Key in YieldType]: number } = {
  staking: 1,
  "liquid-staking": 2,
  vault: 3,
  lending: 4,
  restaking: 5,
};
