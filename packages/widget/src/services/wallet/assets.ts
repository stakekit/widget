import type { Network } from "../../domain/schema/network-model";
import { config } from "../../shared/config/widget-defaults";

export const getWalletNetworkLogo = (network: Network) =>
  `${config.assetsUrl}/networks/${network}.svg`;

export const getWalletTokenLogo = (tokenName: string) =>
  `${config.assetsUrl}/tokens/${tokenName}.svg`;

export const walletImages = {
  bitget: `${config.assetsUrl}/widget/bitget.png`,
  ledgerLogo: `${config.assetsUrl}/widget/ledger-logo.svg`,
  wcLogo: `${config.assetsUrl}/widget/wc-logo.svg`,
} as const;
