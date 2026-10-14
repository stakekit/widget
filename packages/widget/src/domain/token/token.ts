import { Schema, Struct } from "effect";
import * as LegacyApi from "../../generated/api/legacy-schema";
import * as YieldApi from "../../generated/api/yield-schema";
import { addressIdentity, TokenAddress } from "../identity/identifiers";

// Host wallets receive the whole token as `SKToken`, so every field it
// publishes is picked.
export const Token = Schema.Struct({
  ...Struct.pick(YieldApi.TokenDto.fields, [
    "symbol",
    "name",
    "network",
    "logoURI",
    "isPoints",
    "coinGeckoId",
  ]),
  address: Schema.optionalKey(TokenAddress),
  decimals: Schema.Finite.check(Schema.isInt()),
});
export type Token = typeof Token.Type;

/** A Legacy API token, decoded through the fields `Token` reads. */
export const LegacyToken = LegacyApi.TokenDto.mapFields(
  Struct.pick([
    "symbol",
    "name",
    "decimals",
    "network",
    "address",
    "logoURI",
    "isPoints",
    "coinGeckoId",
  ])
).pipe(Schema.decodeTo(Token));

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
