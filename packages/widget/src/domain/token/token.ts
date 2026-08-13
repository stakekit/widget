import { Schema } from "effect";
import * as YieldApi from "../../generated/api/yield-schema";
import { TokenAddress } from "../identity/identifiers";
import { EvmNetworks } from "../network/networks";

export const Token = Schema.Struct({
  ...YieldApi.TokenDto.fields,
  address: Schema.optionalKey(TokenAddress),
  decimals: Schema.Number.check(Schema.isInt()),
});
export type Token = typeof Token.Type;

export type TokenString = `${Token["network"]}-${string}-${string}`;

type TokenLike = Pick<Token, "symbol"> & {
  network: string;
  address?: string;
};

const evmNetworks = new Set<string>(Object.values(EvmNetworks));

const identityAddress = (token: TokenLike) => {
  if (token.address === undefined) return "<no-address>";
  return evmNetworks.has(token.network)
    ? token.address.toLowerCase()
    : token.address;
};

export const tokenString = (token: TokenLike): TokenString => {
  return `${token.network}-${token.symbol}-${identityAddress(token)}` as TokenString;
};

export const equalTokens = (a: TokenLike, b: TokenLike) =>
  tokenString(a) === tokenString(b);
