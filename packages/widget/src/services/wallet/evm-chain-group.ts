import { getNetworkLogo } from "./network-assets";
import type { WalletChainGroup } from "./wallet-descriptors";

export const evmChainGroup: WalletChainGroup = {
  iconUrl: getNetworkLogo("ethereum"),
  title: "EVM",
  id: "evm",
};
