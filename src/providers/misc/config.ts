import { MiscNetworks } from "@stakekit/common";
import { Chain } from "@stakekit/rainbowkit";
import { MiscChainsMap } from "../../domain/types/chains";
import { isLedgerDappBrowserProvider } from "../../utils";

export const near = {
  id: 397,
  name: "NEAR Protocol",
  iconUrl:
    "https://raw.githubusercontent.com/stakekit/assets/main/tokens/near.svg",
  network: "near",
  nativeCurrency: {
    decimals: 24,
    name: "Near",
    symbol: "NEAR",
  },
  rpcUrls: {
    public: { http: ["https://rpc.mainnet.near.org"] },
    default: { http: ["https://rpc.mainnet.near.org"] },
  },
} as const satisfies Chain;

export const tron = {
  id: 1,
  name: "Tron Network",
  iconUrl:
    "https://raw.githubusercontent.com/stakekit/assets/main/tokens/tron.svg",
  network: "tron",
  nativeCurrency: {
    decimals: 6,
    name: "Tron",
    symbol: "TRX",
  },
  rpcUrls: {
    public: { http: ["https://api.trongrid.io"] },
    default: { http: ["https://api.trongrid.io"] },
  },
} as const satisfies Chain;

export const miscChainMap: MiscChainsMap = {
  [MiscNetworks.Near]: {
    type: "misc",
    skChainName: MiscNetworks.Near,
    wagmiChain: near,
  },
  [MiscNetworks.Tron]: {
    type: "misc",
    skChainName: MiscNetworks.Tron,
    wagmiChain: tron,
  },
};

export const miscChains = isLedgerDappBrowserProvider()
  ? Object.values(miscChainMap).map((val) => val.wagmiChain)
  : [];
