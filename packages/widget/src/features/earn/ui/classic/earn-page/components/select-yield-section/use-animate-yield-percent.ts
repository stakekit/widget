import { animate, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { config } from "../../../../../../../shared/config/widget-defaults";
import { APToPercentage } from "../../../../../../../shared/lib/general";
import type { EarnPageModel } from "../../state/types";

export const useAnimateYieldPercent = (
  estimatedRewards: EarnPageModel["estimatedRewards"]
) => {
  const perReward = estimatedRewards
    ? (() => {
        if (
          estimatedRewards.rewardType === "variable" ||
          !estimatedRewards.rewardRateAverage.isPositive()
        ) {
          return "- %";
        }

        return estimatedRewards.rewardRateAverage.toNumber();
      })()
    : null;

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
