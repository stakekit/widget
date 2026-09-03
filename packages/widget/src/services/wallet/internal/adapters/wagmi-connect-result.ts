import type { Address } from "viem";

/**
 * Wagmi types `connect` as a generic whose return depends on `withCapabilities`.
 * A runtime ternary cannot satisfy that conditional type, so wagmi's own
 * connectors cast with `as never`. Keep that cast in one place.
 */
export const wagmiConnectResult = (
  withCapabilities: boolean | undefined,
  accounts: readonly Address[],
  chainId: number
) =>
  ({
    accounts: withCapabilities
      ? accounts.map((address) => ({ address, capabilities: {} }))
      : accounts,
    chainId,
  }) as never;
