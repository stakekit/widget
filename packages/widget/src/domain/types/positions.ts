import type { BalanceTypes, YieldBalanceDto } from "@stakekit/api-hooks";
import type BigNumber from "bignumber.js";

export type PositionBalancesByType = Map<
  BalanceTypes,
  (YieldBalanceDto & {
    tokenPriceInUsd: BigNumber;
  })[]
>;
