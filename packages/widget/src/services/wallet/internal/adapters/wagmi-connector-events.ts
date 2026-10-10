import type { Address } from "viem";
import type { Connector } from "wagmi";

export type WagmiConnectorEvents = Pick<
  Connector,
  "onAccountsChanged" | "onChainChanged" | "onDisconnect"
>;

/**
 * Forwards a non-EVM connector's account, chain, and disconnect notifications
 * to wagmi. Chain ids pass through unchanged (a type cast only) unless the
 * connector supplies its own mapping.
 */
export const makeWagmiConnectorEvents = (
  emitter: Connector["emitter"],
  mapChainId: (chainId: string) => number = (chainId) =>
    chainId as unknown as number
): WagmiConnectorEvents => ({
  onAccountsChanged: (accounts) => {
    if (accounts.length === 0) {
      emitter.emit("disconnect");
    } else {
      emitter.emit("change", { accounts: accounts as Address[] });
    }
  },
  onChainChanged: (chainId) => {
    emitter.emit("change", { chainId: mapChainId(chainId) });
  },
  onDisconnect: () => {
    emitter.emit("disconnect");
  },
});
