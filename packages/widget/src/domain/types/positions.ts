import BigNumber from "bignumber.js";
import type {
  BalanceDto,
  BalancesRequestDto,
  ValidatorDto,
  YieldBalancesDto,
  BalanceType as YieldBalanceTypeGenerated,
} from "../../generated/api/yield";
import { equalTokens } from "..";
import type { YieldRewardRateDto } from "./reward-rate";
import type { TokenDto } from "./tokens";

export type YieldBalanceDto = BalanceDto;
export type YieldBalancesByYieldDto = YieldBalancesDto;
export type YieldBalancesRequestDto = BalancesRequestDto;
export type YieldBalanceType = YieldBalanceTypeGenerated;

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
  | `validator::${ValidatorDto["address"]}`;

export type PositionsData = Map<
  YieldBalancesByYieldDto["yieldId"],
  {
    yieldId: YieldBalancesByYieldDto["yieldId"];
    rewardRate?: YieldRewardRateDto | null;
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

export const getPositionTotalAmount = (
  balances: YieldBalanceDto[],
  baseToken: TokenDto
) => {
  const baseTokenBalance = balances.find((b) =>
    equalTokens(b.token, baseToken)
  );

  const baseTokenPriceInUsd = (() => {
    if (!baseTokenBalance?.amountUsd) return null;

    const amount = BigNumber(baseTokenBalance.amount);
    if (amount.lte(0)) return null;

    return BigNumber(baseTokenBalance.amountUsd).dividedBy(amount);
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

      const balanceAmountUsd = BigNumber(b.amountUsd ?? 0);

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
