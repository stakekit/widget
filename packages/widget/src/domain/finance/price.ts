import BigNumber from "bignumber.js";
import type { Prices } from "../health/models";

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
  const amountBN = BigNumber(amount);

  if (pricePerShare && baseToken) {
    const baseTokenPrice = new BigNumber(
      prices.getByToken(baseToken)?.price ?? 0
    );
    const pricePerShareBN = BigNumber(pricePerShare);

    return amountBN.times(baseTokenPrice).times(pricePerShareBN);
  }

  const tokenPrice = new BigNumber(prices.getByToken(token)?.price ?? 0);

  return amountBN.times(tokenPrice);
};
