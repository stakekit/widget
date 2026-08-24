import type { ChainGroup } from "@stakekit/rainbowkit";
import { getNetworkLogo } from "./network-assets";

export const evmChainGroup: ChainGroup = {
  iconUrl: getNetworkLogo("ethereum"),
  title: "EVM",
  id: "evm",
};
