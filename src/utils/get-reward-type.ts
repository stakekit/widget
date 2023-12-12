import { YieldDto } from "@stakekit/api-hooks";

export const getRewardTypeFormatted = (rewardType: YieldDto["rewardType"]) => {
  switch (rewardType) {
    case "apr":
      return "APR";

    case "apy":
      return "APY";

    default:
      return "";
  }
};
