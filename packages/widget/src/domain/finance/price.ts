import type BigNumber from "bignumber.js";
import type { Prices } from "../health/models";
import { exactDecimal } from "./exact";

type PriceLookupToken = {
  readonly symbol: string;
  readonly network: string;
  readonly address?: string;
};

export const getTokenPriceInUSD = ({
  token,
  baseToken,
  amount,
  prices,
  pricePerShare,
}: {
  token: PriceLookupToken;
  baseToken: PriceLookupToken | null;
  amount: string | BigNumber;
  pricePerShare: string | null;
  prices: Prices;
}): BigNumber => {
  const amountBN = exactDecimal(amount);

  if (pricePerShare && baseToken) {
    const baseTokenPrice = exactDecimal(
      prices.getByToken(baseToken)?.price ?? 0
    );
    const pricePerShareBN = exactDecimal(pricePerShare);

    return amountBN.times(baseTokenPrice).times(pricePerShareBN);
  }

  const tokenPrice = exactDecimal(prices.getByToken(token)?.price ?? 0);

  return amountBN.times(tokenPrice);
};
