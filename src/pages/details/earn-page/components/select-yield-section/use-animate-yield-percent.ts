import { animate, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import type { DetailsContextType } from "../../state/types";

export const useAnimateYieldPercent = (
  estimatedRewards: DetailsContextType["estimatedRewards"]
) => {
  const perReward = estimatedRewards
    .map((val) => {
      const parsedNum = parseFloat(val.percentage);

      if (isNaN(parsedNum)) return val.percentage;

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
    (val) => val.toFixed(2) + "%"
  );

  return typeof perReward === "string" ? perReward : transformedMotionValue;
};
