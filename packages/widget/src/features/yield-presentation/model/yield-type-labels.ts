import type { TFunction } from "i18next";

import {
  type ExtendedYieldType,
  getExtendedYieldType,
} from "../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";

type YieldTypeLabels = {
  readonly title: string;
  readonly review: string;
  readonly cta: string;
};

const yieldTypeLabelKeys = {
  staking: "staking",
  vault: "vault",
  lending: "lending",
  restaking: "restaking",
  liquid_staking: "liquid-staking",
  fixed_yield: "fixed_yield",
  real_world_asset: "real_world_asset",
  concentrated_liquidity_pool: "concentrated_liquidity_pool",
  liquidity_pool: "liquidity_pool",
  native_staking: "native_staking",
  pooled_staking: "pooled_staking",
  unknown: "unknown",
} as const satisfies Record<ExtendedYieldType, string>;

/** How a yield's type reads: as a title, on Review, and on its call to action. */
export const getYieldTypeLabels = (
  yieldDto: EarnYieldWithProvider,
  t: TFunction
): YieldTypeLabels => {
  const key = yieldTypeLabelKeys[getExtendedYieldType(yieldDto)];

  return {
    title: t(`yield_types.${key}.title`),
    review: t(`yield_types.${key}.review`),
    cta: t(`yield_types.${key}.cta`),
  };
};
