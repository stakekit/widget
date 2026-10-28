/**
 * Wagmi types `connect` as a generic whose return depends on `withCapabilities`.
 * A runtime ternary cannot satisfy that conditional type, so wagmi's own
 * connectors cast with `as never`. Keep that cast in one place.
 */
export const wagmiConnectResult = (
  withCapabilities: boolean | undefined,
  accounts: readonly string[],
  chainId: number
) => {
  const result = {
    accounts: withCapabilities
      ? accounts.map((address) => ({ address, capabilities: {} }))
      : accounts,
    chainId,
  };
  // biome-ignore lint/nursery/noUnsafeTypeAssertion: wagmi's connect return type is conditional on the withCapabilities generic, which a runtime value cannot satisfy
  return result as never;
};
