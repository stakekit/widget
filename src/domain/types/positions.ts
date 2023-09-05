import { BalanceTypes, YieldBalanceDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";

export type PositionBalancesByType = Map<
  BalanceTypes,
  YieldBalanceDto & {
    tokenPriceInUsd: BigNumber;
  }
>;
