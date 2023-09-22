import { Chain } from "@stakekit/rainbowkit";
import { getTokenLogo, isLedgerDappBrowserProvider } from "../../utils";
import { MiscChainsMap } from "../../domain/types/chains";
import { MiscNetworks } from "@stakekit/common";

export const near = {
  id: 397,
  name: "NEAR Protocol",
  iconUrl: getTokenLogo("near"),
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

export const tezos = {
  id: 1729,
  name: "Tezos",
  iconUrl: getTokenLogo("xtz"),
  network: "NetXdQprcVkpaWU",
  nativeCurrency: {
    decimals: 6,
    name: "Tezos",
    symbol: "XTZ",
  },
  rpcUrls: {
    public: { http: ["https://rpc.tzbeta.net/"] },
    default: { http: ["https://rpc.tzbeta.net/"] },
  },
} as const satisfies Chain;

export const miscChainMap: MiscChainsMap = {
  [MiscNetworks.Near]: {
    type: "misc",
    skChainName: MiscNetworks.Near,
    wagmiChain: near,
  },
  [MiscNetworks.Tezos]: {
    type: "misc",
    skChainName: MiscNetworks.Tezos,
    wagmiChain: tezos,
  },
};

export const miscChains = isLedgerDappBrowserProvider()
  ? Object.values(miscChainMap).map((val) => val.wagmiChain)
  : [];
