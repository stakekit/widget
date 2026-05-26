import { animate, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { config } from "../../../../../config";
import { APToPercentage } from "../../../../../utils";
import type { EarnPageContextType } from "../../state/types";

export const useAnimateYieldPercent = (
  estimatedRewards: EarnPageContextType["estimatedRewards"]
) => {
  const perReward = estimatedRewards
    .map((val) => {
      if (
        val.rewardType === "variable" ||
        !val.rewardRateAverage.isPositive()
      ) {
        return "- %";
      }

      return val.rewardRateAverage.toNumber();
    })
    .extractNullable();

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
    ? estimatedRewards.extract()?.percentage
    : transformedMotionValue;
};
