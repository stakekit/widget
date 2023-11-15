import { Chain } from "@stakekit/rainbowkit";
import {
  getTokenLogo,
  isLedgerDappBrowserProvider,
  typeSafeObjectEntries,
  typeSafeObjectFromEntries,
} from "../../utils";
import { MiscChainsMap } from "../../domain/types/chains";
import { MiscNetworks } from "@stakekit/common";
import { queryClient } from "../../services/query-client";
import { getEnabledNetworks } from "../api/get-enabled-networks";
import { config } from "../../config";
import { EitherAsync } from "purify-ts";

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

export const solana = {
  id: 501,
  name: "Solana",
  iconUrl: getTokenLogo("sol"),
  network: "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ",
  nativeCurrency: {
    decimals: 9,
    name: "Solana",
    symbol: "SOL",
  },
  rpcUrls: {
    public: { http: ["https://api.mainnet-beta.solana.com/"] },
    default: { http: ["https://api.mainnet-beta.solana.com/"] },
  },
} as const satisfies Chain;

export const tron = {
  id: 79,
  name: "Tron",
  iconUrl: getTokenLogo("trx"),
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

const queryKey = [config.appPrefix, "misc-config"];
const staleTime = Infinity;

const queryFn = async () =>
  getEnabledNetworks().caseOf({
    Right: (networks) => {
      const miscChainsMap: Partial<MiscChainsMap> = typeSafeObjectFromEntries(
        typeSafeObjectEntries<MiscChainsMap>({
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
          [MiscNetworks.Solana]: {
            type: "misc",
            skChainName: MiscNetworks.Solana,
            wagmiChain: solana,
          },
          [MiscNetworks.Tron]: {
            type: "misc",
            skChainName: MiscNetworks.Tron,
            wagmiChain: tron,
          },
        }).filter(([_, v]) => networks.has(v.skChainName))
      );

      const miscChains = isLedgerDappBrowserProvider()
        ? Object.values(miscChainsMap).map((val) => val.wagmiChain)
        : [];

      return Promise.resolve({ miscChainsMap, miscChains });
    },
    Left: (l) => Promise.reject(l),
  });

export const getConfig = () =>
  EitherAsync(() =>
    queryClient.fetchQuery({ staleTime, queryKey, queryFn })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get misc config");
  });
