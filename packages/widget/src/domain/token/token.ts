import { Schema } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { TokenAddress } from "../identity/identifiers";
import { isEvmNetwork } from "../network/network";

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

const identityAddress = (token: TokenLike) => {
  if (token.address === undefined) return "<no-address>";
  return isEvmNetwork(token.network)
    ? token.address.toLowerCase()
    : token.address;
};

export const tokenString = (token: TokenLike): TokenString => {
  return `${token.network}-${token.symbol}-${identityAddress(token)}` as TokenString;
};

export const equalTokens = (a: TokenLike, b: TokenLike) =>
  tokenString(a) === tokenString(b);
