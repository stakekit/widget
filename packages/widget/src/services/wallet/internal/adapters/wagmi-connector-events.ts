import type { Connector } from "wagmi";
import {
  toWagmiAccounts,
  toWagmiChainId,
  type WalletRoutingId,
} from "../wagmi-seam";

export type WagmiConnectorEvents = Pick<
  Connector,
  "onAccountsChanged" | "onChainChanged" | "onDisconnect"
>;

/**
 * Forwards a non-EVM connector's account, chain, and disconnect notifications
 * to wagmi. Chain ids pass through unchanged unless the connector supplies its
 * own mapping.
 */
export const makeWagmiConnectorEvents = (
  emitter: Connector["emitter"],
  mapChainId: (chainId: string) => WalletRoutingId = (chainId) => chainId
): WagmiConnectorEvents => ({
  onAccountsChanged: (accounts) => {
    if (accounts.length === 0) {
      emitter.emit("disconnect");
    } else {
      emitter.emit("change", { accounts: toWagmiAccounts(accounts) });
    }
  },
  onChainChanged: (chainId) => {
    emitter.emit("change", { chainId: toWagmiChainId(mapChainId(chainId)) });
  },
  onDisconnect: () => {
    emitter.emit("disconnect");
  },
});
