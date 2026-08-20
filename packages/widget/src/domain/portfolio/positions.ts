import type BigNumber from "bignumber.js";
import type { EarnBalance, EarnPosition, EarnValidator } from "../earn/models";
import type { YieldRewardRate } from "../earn/reward-rate";
import type { ValidatorKey } from "../earn/validator";
import { exactDecimal, exactZero } from "../finance/exact";
import type { YieldId } from "../identity/identifiers";
import { equalTokens } from "../token/token";

export type YieldBalanceType = EarnBalance["type"];

export type PositionBalancesByType = Map<
  YieldBalanceType,
  (EarnBalance & {
    tokenPriceInUsd: BigNumber;
  })[]
>;
export type PositionValidators = ReadonlyArray<EarnValidator>;

export type PositionDetailsLabelType = "hasFrozenV1";

type BalanceType = "validators" | "default";

export type BalanceDataKey = BalanceType | `validator::${ValidatorKey}`;

export type PositionsData = Map<
  YieldId,
  {
    yieldId: YieldId;
    rewardRate?: YieldRewardRate | null;
    balanceData: Map<
      BalanceDataKey,
      { balances: EarnBalance[] } & (
        | { type: "validators"; validators: PositionValidators }
        | { type: "default" }
      )
    >;
  }
>;

export const hasActivePositionForYield = (
  positions: PositionsData,
  yieldId: YieldId
) =>
  Array.from(positions.get(yieldId)?.balanceData.values() ?? []).some(
    (position) => position.balances.some((balance) => balance.type === "active")
  );

export type PositionData =
  PositionsData extends Map<YieldId, infer Value> ? Value : never;

type PositionBalances =
  PositionData["balanceData"] extends Map<BalanceDataKey, infer Value>
    ? Value & { rewardRate: PositionData["rewardRate"] }
    : never;

export const getPositionBalanceDataKey = (
  balance: EarnBalance
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

const getBalanceValidators = (balance: EarnBalance) =>
  balance.validators ?? (balance.validator ? [balance.validator] : []);

export const toPositionsData = (
  balancesData: ReadonlyArray<EarnPosition>
): PositionsData =>
  balancesData.reduce((positions, position) => {
    positions.set(position.yieldId, {
      yieldId: position.yieldId,
      rewardRate: position.rewardRate,
      balanceData: [...position.balances]
        .sort((a, b) =>
          getPositionBalanceDataKey(a).localeCompare(
            getPositionBalanceDataKey(b)
          )
        )
        .reduce(
          (balances, balance) => {
            const key = getPositionBalanceDataKey(balance);
            const previous = balances.get(key);

            if (previous) {
              previous.balances.push(balance);
            } else if (key === "default") {
              balances.set(key, {
                balances: [balance],
                type: "default",
              });
            } else {
              balances.set(key, {
                balances: [balance],
                type: "validators",
                validators: getBalanceValidators(balance),
              });
            }

            return balances;
          },
          new Map() as PositionData["balanceData"]
        ),
    });

    return positions;
  }, new Map() as PositionsData);

export const getPositionData = (
  positions: PositionsData,
  yieldId: YieldId | null
): PositionData | null => (yieldId ? (positions.get(yieldId) ?? null) : null);

export const getPositionBalances = (
  position: PositionData | null,
  balanceId: string | null
): PositionBalances | null => {
  if (!position || !balanceId) return null;

  const balanceData =
    position.balanceData.get(balanceId as BalanceDataKey) ??
    position.balanceData.values().next().value;

  return balanceData
    ? { ...balanceData, rewardRate: position.rewardRate }
    : null;
};

export const toPositionBalancesByType = (
  balances: ReadonlyArray<EarnBalance>
): PositionBalancesByType =>
  balances.reduce((byType, balance) => {
    const amount = exactDecimal(balance.amount);
    if (amount.isZero() || amount.isNaN()) return byType;

    const tokenPriceInUsd = exactDecimal(
      String(balance.amountUsd ?? 0).replace(/,/g, "")
    );
    const previous = byType.get(balance.type);

    byType.set(balance.type, [
      ...(previous ?? []),
      { ...balance, tokenPriceInUsd },
    ]);

    return byType;
  }, new Map() as PositionBalancesByType);

export const getPositionTotalAmount = (
  balances: EarnBalance[],
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

      const balanceAmountUsd = b.amountUsd ?? exactZero();

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
    { amount: exactZero(), amountUsd: exactZero() }
  );
};
