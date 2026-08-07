import type { AppToken } from "../schema/legacy-models";

export type TokenString = `${AppToken["network"]}-${string}`;

type TokenLike = Pick<AppToken, "symbol"> & {
  network: string;
  address?: string;
};

export const tokenString = (token: TokenLike): TokenString => {
  return `${token.network}-${token.address?.toLowerCase() ?? ""}` as TokenString;
};

export const equalTokens = (a: TokenLike, b: TokenLike) =>
  tokenString(a) === tokenString(b) && a.symbol === b.symbol;
