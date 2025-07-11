import type { TokenDto } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { tokenString } from "..";
import type { TokenString } from "./tokens";

export type Price = {
  price: number | undefined;
  price24H: number | undefined;
};

export class Prices {
  constructor(public value: Map<TokenString, Price>) {}

  getByToken(token: TokenDto) {
    return Maybe.fromNullable(this.value.get(tokenString(token)));
  }
}

export const getTokenPriceInUSD = ({
  token,
  baseToken,
  amount,
  prices,
  pricePerShare,
}: {
  token: TokenDto;
  baseToken: TokenDto | null;
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
