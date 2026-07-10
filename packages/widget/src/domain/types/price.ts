import BigNumber from "bignumber.js";
import { Prices } from "../schema/health-price-models";

export { Prices };

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
      prices
        .getByToken(baseToken)
        .chainNullable((v) => v.price)
        .orDefault(0)
    );
    const pricePerShareBN = BigNumber(pricePerShare);

    return amountBN.times(baseTokenPrice).times(pricePerShareBN);
  }

  const tokenPrice = new BigNumber(
    prices
      .getByToken(token)
      .chainNullable((v) => v.price)
      .orDefault(0)
  );

  return amountBN.times(tokenPrice);
};
