import { Chain } from "@stakekit/rainbowkit";
import { isLedgerDappBrowserProvider } from "../../utils";
import { MiscChainsMap } from "../../domain/types/chains";
import { MiscNetworks } from "@stakekit/common";

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

export const miscChainMap: MiscChainsMap = {
  [MiscNetworks.Near]: {
    type: "misc",
    skChainName: MiscNetworks.Near,
    wagmiChain: near,
  },
};

export const miscChains = isLedgerDappBrowserProvider()
  ? Object.values(miscChainMap).map((val) => val.wagmiChain)
  : [];
