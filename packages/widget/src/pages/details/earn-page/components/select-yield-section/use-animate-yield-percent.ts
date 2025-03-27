import { config } from "@sk-widget/config";
import { animate, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import type { EarnPageContextType } from "../../state/types";

export const useAnimateYieldPercent = (
  estimatedRewards: EarnPageContextType["estimatedRewards"]
) => {
  const perReward = estimatedRewards
    .map((val) => {
      const parsedNum = Number.parseFloat(val.percentage);

      if (Number.isNaN(parsedNum)) return val.percentage;

      return parsedNum;
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
    (val) => `${val.toFixed(2)}%`
  );

  return typeof perReward === "string" || config.env.isTestMode
    ? estimatedRewards.extract()?.percentage
    : transformedMotionValue;
};
