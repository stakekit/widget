import BigNumber from "bignumber.js";
import type {
  YieldBalanceDto,
  YieldBalancesByYieldDto,
  YieldBalanceType,
} from "../../providers/yield-api-client-provider/types";
import type { components } from "../../types/yield-api-schema";

export type PositionBalancesByType = Map<
  YieldBalanceType,
  (YieldBalanceDto & {
    tokenPriceInUsd: BigNumber;
  })[]
>;

export type PositionDetailsLabelType = "hasFrozenV1";

type BalanceType = "validators" | "default";

export type BalanceDataKey =
  | BalanceType
  | `validator::${components["schemas"]["ValidatorDto"]["address"]}`;

export type PositionsData = Map<
  YieldBalancesByYieldDto["yieldId"],
  {
    yieldId: YieldBalancesByYieldDto["yieldId"];
    balanceData: Map<
      BalanceDataKey,
      { balances: YieldBalanceDto[] } & (
        | { type: "validators"; validatorsAddresses: string[] }
        | { type: "default" }
      )
    >;
  }
>;

export const getPositionBalanceDataKey = (
  balance: YieldBalanceDto
): BalanceDataKey => {
  if (Array.isArray(balance.validators) && balance.validators.length > 1) {
    return "validators";
  }

  if (balance.validator?.address) {
    return `validator::${balance.validator.address}` as BalanceDataKey;
  }

  return "default";
};

export const getPositionTotalAmount = (balances: YieldBalanceDto[]) =>
  balances.reduce(
    (acc, b) => {
      if (b.token.isPoints) return acc;

      acc.amount = BigNumber(b.amount).plus(acc.amount);
      acc.amountUsd = BigNumber(b.amountUsd ?? 0).plus(acc.amountUsd);

      return acc;
    },
    { amount: new BigNumber(0), amountUsd: new BigNumber(0) }
  );
