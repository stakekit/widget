import type BigNumber from "bignumber.js";
import type { TFunction } from "i18next";
import { exactDecimal } from "../../../domain/finance/exact";
import type { YieldRewardsSummary } from "../../../domain/portfolio/models";
import type { PositionBalancesByType } from "../../../domain/portfolio/positions";
import { equalTokens, sameTokenContract } from "../../../domain/token/token";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../shared/lib/number-format";

/** What the wallet earned in the position, as its page shows it. */
export type PositionEarned = {
  /** Last 7 days, signed, in the token: "+0.0123 POL". */
  readonly value: string;
  /**
   * Its USD value when the token is priced, then everything earned since
   * the wallet was first indexed: "+$0.01 · 0.52 POL total".
   */
  readonly caption: string;
  /** A gain reads as `success`, a loss as `danger`. */
  readonly tone: "default" | "success" | "danger";
};

// A gain reads with a plus; a loss carries its minus already, and a bound
// such as "<$0.01" reads as it is.
const withSign = (amount: BigNumber, formatted: string) =>
  amount.isGreaterThan(0) && !formatted.startsWith("<")
    ? `+${formatted}`
    : formatted;

const toneOf = (amount: BigNumber): PositionEarned["tone"] => {
  if (amount.isGreaterThan(0)) return "success";
  return amount.isLessThan(0) ? "danger" : "default";
};

/**
 * The token's USD price per unit from the position's own balances, when one
 * of them holds it priced. A balance's `tokenPriceInUsd` is its whole USD
 * value, so the price is that over its amount.
 */
const findTokenPriceUsd = (
  token: YieldRewardsSummary["token"],
  positionBalancesByType: PositionBalancesByType
) => {
  for (const balances of positionBalancesByType.values()) {
    for (const balance of balances) {
      const amount = exactDecimal(balance.amount);
      if (
        !balance.isEncrypted &&
        amount.isGreaterThan(0) &&
        balance.tokenPriceInUsd.isGreaterThan(0) &&
        (equalTokens(balance.token, token) ||
          sameTokenContract(balance.token, token))
      ) {
        return balance.tokenPriceInUsd.dividedBy(amount);
      }
    }
  }
  return null;
};

/**
 * The position's Earned figure: the last 7 days as its value, its USD value
 * and the total under it. Null when the Yield's earnings are untracked or
 * every window is zero, which reads as unknown rather than as nothing
 * earned.
 */
export const getPositionEarned = ({
  locale,
  positionBalancesByType,
  rewardsSummary,
  t,
}: {
  locale: string;
  positionBalancesByType: PositionBalancesByType;
  rewardsSummary: YieldRewardsSummary | undefined;
  t: TFunction;
}): PositionEarned | null => {
  if (!rewardsSummary) return null;

  const { last24H, last7D, last30D, lastYear, total, token } = rewardsSummary;
  if (
    [last24H, last7D, last30D, lastYear, total].every((window) =>
      window.amount.isZero()
    )
  ) {
    return null;
  }

  const week = last7D.amount;
  const price = findTokenPriceUsd(token, positionBalancesByType);
  const formatWithSymbol = (amount: BigNumber) =>
    `${formatTokenAmount(amount, locale, "down")} ${token.symbol}`;
  const totalText = formatWithSymbol(total.amount);
  // A quiet week has no value to put in USD.
  const weekUsd =
    price && !week.isZero()
      ? withSign(week, formatUsd(week.times(price), locale))
      : null;

  return {
    value: withSign(week, formatWithSymbol(week)),
    caption: [
      weekUsd,
      t("position_details.earned_total", { amount: totalText }),
    ]
      .filter((part) => part !== null)
      .join(" · "),
    tone: toneOf(week),
  };
};
