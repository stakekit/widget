import type { AppToken } from "../schema/legacy-models";

export type YieldTokenDto = typeof AppToken.Encoded;
export type TokenDto = typeof AppToken.Encoded;

export type TokenString = `${TokenDto["network"]}-${TokenDto["address"]}`;

type TokenLike = Pick<TokenDto, "symbol"> & {
  network: string;
  address?: string;
};

export const tokenString = (token: TokenLike): TokenString => {
  return `${token.network}-${token.address?.toLowerCase() ?? ""}` as TokenString;
};

export const equalTokens = (a: TokenLike, b: TokenLike) =>
  tokenString(a) === tokenString(b) && a.symbol === b.symbol;
