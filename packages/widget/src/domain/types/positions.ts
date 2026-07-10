import BigNumber from "bignumber.js";
import { equalTokens } from "..";
import type { EarnBalance, EarnPosition } from "../schema/earn-models";
import type { YieldRewardRateDto } from "./reward-rate";
import type { Validator, ValidatorKey } from "./validators";

export type YieldBalanceDto = EarnBalance;
export type YieldBalancesByYieldDto = EarnPosition;
export type YieldBalanceType = EarnBalance["type"];

export type PositionBalancesByType = Map<
  YieldBalanceType,
  (YieldBalanceDto & {
    tokenPriceInUsd: BigNumber;
  })[]
>;
export type PositionValidators = ReadonlyArray<Validator>;

export type PositionDetailsLabelType = "hasFrozenV1";

type BalanceType = "validators" | "default";

export type BalanceDataKey = BalanceType | `validator::${ValidatorKey}`;

export type PositionsData = Map<
  string,
  {
    yieldId: string;
    rewardRate?: YieldRewardRateDto | null;
    balanceData: Map<
      BalanceDataKey,
      { balances: YieldBalanceDto[] } & (
        | { type: "validators"; validators: PositionValidators }
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

  const validator = balance.validator ?? balance.validators?.[0];

  if (validator) {
    return `validator::${validator.key}` as BalanceDataKey;
  }

  return "default";
};

export const getPositionTotalAmount = (
  balances: YieldBalanceDto[],
  baseToken: {
    readonly address?: string;
    readonly symbol: string;
    readonly network: string;
  }
) => {
  const baseTokenBalance = balances.find((b) =>
    equalTokens(b.token, baseToken)
  );

  const baseTokenPriceInUsd = (() => {
    if (!baseTokenBalance?.amountUsd) return null;

    const amount = baseTokenBalance.amount;
    if (amount.lte(0)) return null;

    return baseTokenBalance.amountUsd.dividedBy(amount);
  })();

  return balances.reduce(
    (acc, b) => {
      if (b.token.isPoints) return acc;

      if (baseTokenBalance && equalTokens(b.token, baseTokenBalance.token)) {
        return {
          amount: acc.amount.plus(b.amount),
          amountUsd: acc.amountUsd.plus(b.amountUsd ?? 0),
        };
      }

      const balanceAmountUsd = b.amountUsd ?? BigNumber(0);

      if (baseTokenPriceInUsd && !baseTokenPriceInUsd.isZero()) {
        return {
          amount: acc.amount.plus(
            balanceAmountUsd.dividedBy(baseTokenPriceInUsd)
          ),
          amountUsd: acc.amountUsd.plus(balanceAmountUsd),
        };
      }

      return {
        amount: acc.amount.plus(b.amount),
        amountUsd: acc.amountUsd.plus(balanceAmountUsd),
      };
    },
    { amount: new BigNumber(0), amountUsd: new BigNumber(0) }
  );
};
