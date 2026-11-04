import type { Address } from "viem";

/** A Cosmos chain id such as `cosmoshub-4`; Cosmos wallets route by it. */
type CosmosChainReference = string;

/**
 * The id a connection routes by. EVM, Substrate, and the misc chains use
 * numbers; Cosmos chains use their chain reference.
 */
export type WalletRoutingId = number | CosmosChainReference;

/** Reads a connector-reported chain id: numeric strings are numbers, anything else is a Cosmos chain reference. */
export const parseWalletRoutingId = (chainId: string): WalletRoutingId => {
  const numericChainId = Number(chainId);

  return Number.isNaN(numericChainId) ? chainId : numericChainId;
};

/** Hands a routing id to wagmi, which stores it unchanged as the connection's `chainId`. */
export const toWagmiChainId = (routingId: WalletRoutingId): number =>
  // biome-ignore lint/nursery/noUnsafeTypeAssertion: wagmi types Chain["id"] and connector chain ids as number; Cosmos chain references travel through that slot as strings at runtime
  routingId as number;

/** Reads a chain id back from wagmi, where Cosmos chain references sit in the numeric slot. */
export const fromWagmiChainId = (chainId: number): WalletRoutingId => chainId;

/** Hands a connected account to wagmi, which stores it unchanged. */
export const toWagmiAccount = (address: string): Address =>
  // biome-ignore lint/nursery/noUnsafeTypeAssertion: wagmi types connector accounts as EVM Address; non-EVM connectors carry their native address formats through that slot
  address as Address;

/** Hands a connector's account list to wagmi as the same array. */
export const toWagmiAccounts = (
  addresses: readonly string[]
): readonly Address[] =>
  // biome-ignore lint/nursery/noUnsafeTypeAssertion: wagmi types connector accounts as EVM Address; non-EVM connectors carry their native address formats through that slot
  addresses as readonly Address[];
