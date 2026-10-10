import { Effect } from "effect";
import type { Store } from "mipd";
import { type CreateConnectorFn, ProviderNotFoundError } from "wagmi";
import type { WalletAvailability } from "../../../wallet-descriptors";
import { WalletNotAvailableError } from "../../../wallet-errors";
import { wagmiConnectResult } from "../wagmi-connect-result";

/** An injected wallet detected while its EIP-6963 provider is announced. */
export const announcedWalletAvailability = ({
  installUrl,
  rdns,
  store,
}: {
  readonly installUrl?: string;
  readonly rdns: string;
  readonly store: Pick<Store, "findProvider">;
}): WalletAvailability => ({
  _tag: "Injected",
  detect: Effect.sync(() => store.findProvider({ rdns }) !== undefined),
  installUrl,
});

/**
 * Rejects `connect` with {@link WalletNotAvailableError} when wagmi finds no
 * injected provider, e.g. the extension was removed after the picker opened.
 */
export const failWhenProviderMissing =
  (walletId: string, createConnector: CreateConnectorFn): CreateConnectorFn =>
  (config) => {
    const connector = createConnector(config);
    return {
      ...connector,
      async connect(parameters) {
        try {
          const result = await connector.connect({
            ...parameters,
            withCapabilities: false,
          });
          return wagmiConnectResult(
            parameters?.withCapabilities,
            result.accounts,
            result.chainId
          );
        } catch (cause) {
          if (cause instanceof ProviderNotFoundError) {
            throw new WalletNotAvailableError({ walletId });
          }
          throw cause;
        }
      },
    };
  };
