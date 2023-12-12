import { YieldDto } from "@stakekit/api-hooks";
import { APToPercentage } from ".";

export const getRewardRateFormatted = (
  opts: Pick<YieldDto, "rewardRate" | "rewardType">
) => {
  const { rewardRate, rewardType } = opts;

  if (rewardType === "variable" || !rewardRate) {
    return "- %";
  }

  return `${APToPercentage(rewardRate)}%`;
};
