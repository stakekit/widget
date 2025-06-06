import { EvmNetworks, type TokenDto } from "@stakekit/api-hooks";

export type TokenString = `${TokenDto["network"]}-${TokenDto["address"]}`;

export const isUSDeToken = (token: TokenDto) =>
  token.network === EvmNetworks.ethereum &&
  token.address === "0x4c9edd5852cd905f086c759e8383e09bff1e68b3";
