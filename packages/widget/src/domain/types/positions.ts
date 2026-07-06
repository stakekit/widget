import BigNumber from "bignumber.js";
import type {
  BalanceDto,
  BalancesRequestDto,
  YieldBalancesDto,
  BalanceType as YieldBalanceTypeGenerated,
} from "../../generated/api/yield";
import { equalTokens } from "..";
import type { YieldRewardRateDto } from "./reward-rate";
import type { TokenDto } from "./tokens";
import {
  toValidator,
  toValidators,
  type Validator,
  type ValidatorKey,
} from "./validators";

export type YieldBalanceDto = Omit<BalanceDto, "validator" | "validators"> & {
  readonly validator?: Validator;
  readonly validators?: ReadonlyArray<Validator>;
};
export type YieldBalancesByYieldDto = Omit<YieldBalancesDto, "balances"> & {
  readonly balances: ReadonlyArray<YieldBalanceDto>;
};
export type YieldBalancesRequestDto = BalancesRequestDto;
export type YieldBalanceType = YieldBalanceTypeGenerated;

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
  YieldBalancesByYieldDto["yieldId"],
  {
    yieldId: YieldBalancesByYieldDto["yieldId"];
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

export const toYieldBalance = (balance: BalanceDto): YieldBalanceDto => ({
  ...balance,
  validator: balance.validator ? toValidator(balance.validator) : undefined,
  validators: balance.validators ? toValidators(balance.validators) : undefined,
});

const toYieldBalancesByYield = (
  balancesByYield: YieldBalancesDto
): YieldBalancesByYieldDto => ({
  ...balancesByYield,
  balances: balancesByYield.balances.map(toYieldBalance),
});

export const toYieldBalancesByYields = (
  balancesByYields: ReadonlyArray<YieldBalancesDto>
): YieldBalancesByYieldDto[] => balancesByYields.map(toYieldBalancesByYield);

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
