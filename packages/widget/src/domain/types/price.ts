import type { TokenDto } from "@stakekit/api-hooks";
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
