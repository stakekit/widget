import type { components } from "../../types/yield-api-schema";
import type { Yield } from "./yields";

export type RewardTypes = "apr" | "apy" | "variable";
export type YieldRewardDto = components["schemas"]["RewardDto"];
export type YieldRewardRateDto = components["schemas"]["RewardRateDto"];

export type RewardRateBreakdownKey =
  | "native"
  | "protocol_incentive"
  | "campaign";

export type RewardRateBreakdownItem = {
  key: RewardRateBreakdownKey;
  rate: number;
  rewardType: RewardTypes;
  isUpTo: boolean;
};

const breakdownOrder: RewardRateBreakdownKey[] = [
  "native",
  "protocol_incentive",
  "campaign",
];

export const getRewardTypeFromRateType = (
  rateType: string | null | undefined,
): RewardTypes => {
  const normalized = rateType?.toLowerCase();

  if (normalized === "apr" || normalized === "apy") {
    return normalized;
  }

  return "variable";
};

const getBreakdownKey = (
  yieldSource: YieldRewardDto["yieldSource"],
): RewardRateBreakdownKey =>
  yieldSource === "campaign_incentive"
    ? "campaign"
    : yieldSource === "protocol_incentive"
      ? "protocol_incentive"
      : "native";

export const getYieldRewardRateDetails = (
  yieldDto: Yield | null | undefined,
): YieldRewardRateDto | undefined => yieldDto?.rewardRate;

export const getRewardRateBreakdown = (
  rewardRate: YieldRewardRateDto | null | undefined,
  opts?: {
    showUpToCampaign?: boolean;
  },
): RewardRateBreakdownItem[] => {
  if (!rewardRate?.components?.length) {
    return [];
  }

  const buckets = rewardRate.components.reduce((acc, component) => {
    const key = getBreakdownKey(component.yieldSource);
    const prev = acc.get(key);

    acc.set(key, {
      key,
      rate: (prev?.rate ?? 0) + component.rate,
      rewardType:
        prev?.rewardType ?? getRewardTypeFromRateType(component.rateType),
      isUpTo: key === "campaign" && !!opts?.showUpToCampaign,
    });

    return acc;
  }, new Map<RewardRateBreakdownKey, RewardRateBreakdownItem>());

  return breakdownOrder.flatMap((key) => {
    const item = buckets.get(key);

    return item && item.rate > 0 ? [item] : [];
  });
};
