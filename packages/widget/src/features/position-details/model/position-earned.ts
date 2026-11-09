import type BigNumber from "bignumber.js";
import { exactDecimal } from "../../../domain/finance/exact";
import type { YieldRewardsSummary } from "../../../domain/portfolio/models";
import type { PositionBalancesByType } from "../../../domain/portfolio/positions";
import { equalTokens, sameTokenContract } from "../../../domain/token/token";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../shared/lib/number-format";

/** One Earned amount, as the position's page shows it. */
type PositionEarnedFigure = {
  /**
   * Signed, in USD when the position prices the token ("+$42.44"), else in
   * the token ("+2 DOT").
   */
  readonly value: string;
  /** The token amount under a USD value: "+0.0123 ETH". */
  readonly caption?: string;
  /** A gain reads as `success`, a loss as `danger`. */
  readonly tone: "default" | "success" | "danger";
};

/** What the wallet earned in the position: the last 7 days and all time. */
export type PositionEarned = {
  readonly week: PositionEarnedFigure;
  readonly total: PositionEarnedFigure;
};

// A gain reads with a plus; a loss carries its minus already, and a bound
// such as "<$0.01" reads as it is.
const withSign = (amount: BigNumber, formatted: string) =>
  amount.isGreaterThan(0) && !formatted.startsWith("<")
    ? `+${formatted}`
    : formatted;

const toneOf = (amount: BigNumber): PositionEarnedFigure["tone"] => {
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
 * The position's Earned figures: the last 7 days and everything earned since
 * the wallet was first indexed, each in USD with the token amount under it
 * when the position prices the token. Null when the Yield's earnings are
 * untracked or every window is zero, which reads as unknown rather than as
 * nothing earned.
 */
export const getPositionEarned = ({
  locale,
  positionBalancesByType,
  rewardsSummary,
}: {
  locale: string;
  positionBalancesByType: PositionBalancesByType;
  rewardsSummary: YieldRewardsSummary | undefined;
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

  const price = findTokenPriceUsd(token, positionBalancesByType);
  const toFigure = (amount: BigNumber): PositionEarnedFigure => {
    const tokenText = withSign(
      amount,
      `${formatTokenAmount(amount, locale, "down")} ${token.symbol}`
    );
    if (!price) return { value: tokenText, tone: toneOf(amount) };
    return {
      value: withSign(amount, formatUsd(amount.times(price), locale)),
      // Nothing earned has no token amount worth repeating under its USD.
      ...(amount.isZero() ? {} : { caption: tokenText }),
      tone: toneOf(amount),
    };
  };

  return { week: toFigure(last7D.amount), total: toFigure(total.amount) };
};
