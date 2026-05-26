import type {
  TokenDto as LegacyTokenDto,
  TokenControllerGetTokensParams as TokenGetTokensParams,
} from "../../generated/api/legacy";
import type { TokenDto as YieldTokenDtoGenerated } from "../../generated/api/yield";
import { EvmNetworks } from "./chains/networks";

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

export const isUSDeToken = (token: TokenDto) =>
  token.network === EvmNetworks.Ethereum &&
  token.address === "0x4c9edd5852cd905f086c759e8383e09bff1e68b3";
