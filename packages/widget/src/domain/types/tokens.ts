import {
  EvmNetworks,
  type TokenDto as LegacyTokenDto,
  type TokenGetTokensParams,
} from "@stakekit/api-hooks";
import type { components } from "../../types/yield-api-schema";

export type YieldTokenDto = components["schemas"]["TokenDto"];
export type TokenDto = LegacyTokenDto | YieldTokenDto;
export type { TokenGetTokensParams };

export type TokenString = `${TokenDto["network"]}-${TokenDto["address"]}`;

export const isUSDeToken = (token: TokenDto) =>
  token.network === EvmNetworks.ethereum &&
  token.address === "0x4c9edd5852cd905f086c759e8383e09bff1e68b3";
