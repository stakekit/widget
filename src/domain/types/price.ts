import type { TokenDto } from "@stakekit/api-hooks";
import type { TokenString } from "./tokens";
import { tokenString } from "..";
import { Maybe } from "purify-ts";

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
