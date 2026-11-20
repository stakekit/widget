import type BigNumber from "bignumber.js";

import { getTokenPriceInUSD } from "../../../domain/finance/price";
import { Prices } from "../../../domain/finance/prices";
import type { Token } from "../../../domain/token/token";
import {
  formatTokenAmount,
  formatUsd,
} from "../../../shared/lib/number-format";

/**
 * A fee in its token, such as "0.01 ETH", followed by its USD value when its
 * price is known, such as "0.01 ETH ($25.00)". Null without an amount.
 */
export const formatFeeWithUsd = ({
  amount,
  locale,
  prices,
  token,
}: {
  readonly amount: BigNumber | null;
  readonly locale: string;
  readonly prices: Prices | null;
  readonly token: Token;
}): string | null => {
  if (!amount) return null;

  const usd = getTokenPriceInUSD({
    amount,
    baseToken: null,
    pricePerShare: null,
    prices: prices ?? new Prices(new Map()),
    token,
  });
  const fee = `${formatTokenAmount(amount, locale, "up")} ${token.symbol}`;

  return usd.isGreaterThan(0) ? `${fee} (${formatUsd(usd, locale)})` : fee;
};
