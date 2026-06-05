import type {
  TokenDto as LegacyTokenDto,
  TokenControllerGetTokensParams as TokenGetTokensParams,
} from "../../generated/api/legacy";
import type { TokenDto as YieldTokenDtoGenerated } from "../../generated/api/yield";

export type YieldTokenDto = YieldTokenDtoGenerated;
export type TokenDto = LegacyTokenDto | YieldTokenDto;
export type { TokenGetTokensParams };

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
