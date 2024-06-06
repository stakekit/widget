import type { ActionDto, GasEstimateDto } from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";

export type ActionDtoWithGasEstimate = ActionDto & {
  gasEstimate: Omit<GasEstimateDto, "amount"> & { amount: BigNumber };
};
