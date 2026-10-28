import type BigNumber from "bignumber.js";
import type { Prices } from "../health/models";
import type { Token } from "../token/token";
import { exactZero } from "./exact";

type PriceLookupToken = Pick<Token, "network" | "address">;

export const getTokenPriceInUSD = ({
  token,
  baseToken,
  amount,
  prices,
  pricePerShare,
}: {
  token: PriceLookupToken;
  baseToken: PriceLookupToken | null;
  amount: BigNumber;
  pricePerShare: BigNumber | null;
  prices: Prices;
}): BigNumber => {
  if (pricePerShare && baseToken) {
    const baseTokenPrice = prices.getByToken(baseToken)?.price ?? exactZero();

    return amount.times(baseTokenPrice).times(pricePerShare);
  }

  const tokenPrice = prices.getByToken(token)?.price ?? exactZero();

  return amount.times(tokenPrice);
};
