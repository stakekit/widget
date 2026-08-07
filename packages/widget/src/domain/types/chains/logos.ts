import type { Network } from "../../schema/network-model";

export const getNetworkLogo = (network: Network) =>
  `https://assets.stakek.it/networks/${network}.svg`;

export const getTokenLogo = (tokenName: string) =>
  `https://assets.stakek.it/tokens/${tokenName}.svg`;
