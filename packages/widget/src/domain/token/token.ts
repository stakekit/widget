import { Schema } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { addressIdentity, TokenAddress } from "../identity/identifiers";

export const Token = Schema.Struct({
  ...YieldApi.TokenDto.fields,
  address: Schema.optionalKey(TokenAddress),
  decimals: Schema.Finite.check(Schema.isInt()),
});
export type Token = typeof Token.Type;

export type TokenString = `${Token["network"]}-${string}-${string}`;

type TokenLike = Pick<Token, "symbol"> & {
  network: string;
  address?: string;
};

const identityAddress = (token: TokenLike) =>
  token.address === undefined ? "<no-address>" : addressIdentity(token.address);

export const tokenString = (token: TokenLike): TokenString => {
  return `${token.network}-${token.symbol}-${identityAddress(token)}` as TokenString;
};

export const equalTokens = (a: TokenLike, b: TokenLike) =>
  tokenString(a) === tokenString(b);

/** Yield API sentinel for a network's native token in `inputToken`/`outputToken`. */
export const NATIVE_TOKEN_ADDRESS = "0x";

export const getTokenArgumentAddress = (token: Pick<Token, "address">) =>
  token.address ?? NATIVE_TOKEN_ADDRESS;
