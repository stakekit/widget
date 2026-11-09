import { Schema, Struct } from "effect";

import * as BorrowApi from "../../generated/api/borrow";
import type { Token } from "../token/token";
import { TokenAddress } from "./ids";
import type { BorrowNetwork } from "./network";

export const BorrowToken = Schema.Struct({
  ...Struct.pick(BorrowApi.TokenDto.fields, [
    "symbol",
    "name",
    "decimals",
    "logoURI",
  ]),
  address: Schema.optionalKey(TokenAddress),
});
export type BorrowToken = typeof BorrowToken.Type;

export type BorrowNetworkToken = Token & { readonly network: BorrowNetwork };

/** A Borrow token as an app `Token` on its Borrow network. */
export const toBorrowNetworkToken = ({
  network,
  token,
}: {
  readonly network: BorrowNetwork;
  readonly token: BorrowToken;
}): BorrowNetworkToken => ({
  decimals: token.decimals,
  name: token.name,
  network,
  symbol: token.symbol,
  ...(token.address === undefined ? {} : { address: token.address }),
  ...(token.logoURI ? { logoURI: token.logoURI } : {}),
});
