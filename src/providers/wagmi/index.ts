import { configureChains, createConfig } from "wagmi";
import { publicProvider } from "wagmi/providers/public";
import { evmChains, connector as ethConnector } from "../ethereum/config";
import {
  cosmosWagmiChains,
  connector as cosmosConnector,
} from "../cosmos/config";
import { connectorsForWallets } from "@stakekit/rainbowkit";
import { ledgerLiveConnector } from "../ledger/ledger-connector";
import { miscChains } from "../misc/config";

export const { chains, publicClient, webSocketPublicClient } = configureChains(
  [...evmChains, ...cosmosWagmiChains, ...miscChains],
  [publicProvider()]
);

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: connectorsForWallets([
    ethConnector,
    cosmosConnector,
    ledgerLiveConnector,
  ]),
  publicClient,
  webSocketPublicClient,
});
