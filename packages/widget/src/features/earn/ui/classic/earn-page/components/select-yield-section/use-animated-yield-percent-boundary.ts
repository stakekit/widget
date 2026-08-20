import { animate, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { config } from "../../../../../../../shared/config/widget-defaults";
import { APToPercentage } from "../../../../../../../shared/lib/general";
import { toChartNumber } from "../../../../../../../shared/lib/number-format";
import type { getYieldEstimatedRewards } from "../../../../../../yield-summary/index";

type EstimatedRewards = ReturnType<typeof getYieldEstimatedRewards>;

const resolvePerReward = (
  estimatedRewards: EstimatedRewards
): number | "- %" | null => {
  if (!estimatedRewards) {
    return null;
  }

  if (
    estimatedRewards.rewardType === "variable" ||
    !estimatedRewards.rewardRateAverage.isPositive()
  ) {
    return "- %";
  }

  return toChartNumber(estimatedRewards.rewardRateAverage);
};

// Framer Motion owns an imperative animation value, so this adapter is the
// named third-party presentation lifecycle boundary for the percentage tween.
export const useAnimateYieldPercent = (estimatedRewards: EstimatedRewards) => {
  const perReward = resolvePerReward(estimatedRewards);

  const rewardPercMotionValue = useMotionValue(0);

  useEffect(() => {
    if (perReward === null || typeof perReward === "string") {
      return rewardPercMotionValue.set(0);
    }

    if (perReward !== rewardPercMotionValue.get()) {
      animate(rewardPercMotionValue, perReward, {
        duration: 0.8,
        ease: "easeInOut",
      });
    }
  }, [perReward, rewardPercMotionValue]);

  const transformedMotionValue = useTransform(
    rewardPercMotionValue,
    (val) => `${APToPercentage(val)}%`
  );

  return typeof perReward === "string" || config.env.isTestMode
    ? estimatedRewards?.percentage
    : transformedMotionValue;
};
