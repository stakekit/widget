import { SafeAppProvider } from "@safe-global/safe-apps-provider";
import SafeSDK, { TransactionStatus } from "@safe-global/safe-apps-sdk";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import { Effect } from "effect";
import { getAddress, withTimeout } from "viem";
import { type Connector, createConnector, ProviderNotFoundError } from "wagmi";
import { makeCurrentValueStream } from "../../../../shared/effect/current-value-stream";
import { isWalletIframe } from "../../browser-environment";
import { configMeta, type ExtraProps } from "./safe-connector-meta";

function safe(parameters: { shimDisconnect?: boolean } = {}) {
  const { shimDisconnect = false } = parameters;

  type Provider = SafeAppProvider | undefined;
  type StorageItem = { "safe.disconnected": true };

  let provider_: Provider | undefined;

  let disconnect: Connector["onDisconnect"] | undefined;

  return createConnector<Provider, ExtraProps, StorageItem>((config) => {
    const filteredChains = makeCurrentValueStream<Chain[]>([]);
    const sdk = new SafeSDK();

    const getProvider = async () => {
      // Only allowed in iframe context
      if (!isWalletIframe()) return;

      if (!provider_) {
        // `getInfo` hangs when not used in Safe App iFrame
        // https://github.com/safe-global/safe-apps-sdk/issues/263#issuecomment-1029835840
        const safe = await withTimeout(() => sdk.safe.getInfo(), {
          timeout: 10,
        });
        if (!safe) throw new Error("Could not load Safe information");
        provider_ = new SafeAppProvider(safe, sdk);
      }
      return provider_;
    };

    return {
      id: configMeta.id,
      name: configMeta.name,
      type: configMeta.type,
      async connect(args) {
        const provider = await getProvider();
        if (!provider) throw new ProviderNotFoundError();

        const accounts = await this.getAccounts();
        const chainId = await this.getChainId();
        const chain = config.chains.find((value) => value.id === chainId);
        filteredChains.set(chain ? [chain] : []);

        if (!disconnect) {
          disconnect = this.onDisconnect.bind(this);
          provider.on("disconnect", disconnect);
        }

        // Remove disconnected shim if it exists
        if (shimDisconnect)
          await config.storage?.removeItem("safe.disconnected");

        return {
          accounts: args?.withCapabilities
            ? accounts.map((acc) => ({ address: acc, capabilities: {} }))
            : accounts,
          chainId,
        } as never;
      },
      async disconnect() {
        const provider = await getProvider();
        if (!provider) throw new ProviderNotFoundError();

        if (disconnect) {
          provider.removeListener("disconnect", disconnect);
          disconnect = undefined;
        }

        // Add shim signalling connector is disconnected
        if (shimDisconnect)
          await config.storage?.setItem("safe.disconnected", true);
      },
      async getAccounts() {
        const provider = await getProvider();
        if (!provider) throw new ProviderNotFoundError();
        return (await provider.request({ method: "eth_accounts" })).map(
          getAddress
        );
      },
      async getProvider() {
        // Only allowed in iframe context
        if (!isWalletIframe()) return;

        if (!provider_) {
          // `getInfo` hangs when not used in Safe App iFrame
          // https://github.com/safe-global/safe-apps-sdk/issues/263#issuecomment-1029835840
          const safe = await withTimeout(() => sdk.safe.getInfo(), {
            timeout: 10,
          });
          if (!safe) throw new Error("Could not load Safe information");
          provider_ = new SafeAppProvider(safe, sdk);
        }
        return provider_;
      },
      async getChainId() {
        const provider = await getProvider();
        if (!provider) throw new ProviderNotFoundError();
        return Number(provider.chainId);
      },
      async isAuthorized() {
        try {
          const isDisconnected =
            shimDisconnect &&
            // If shim exists in storage, connector is disconnected
            (await config.storage?.getItem("safe.disconnected"));
          if (isDisconnected) return false;

          const accounts = await this.getAccounts();
          return !!accounts.length;
        } catch {
          return false;
        }
      },
      onAccountsChanged() {
        // Not relevant for Safe because changing account requires app reload.
      },
      onChainChanged() {
        // Not relevant for Safe because Safe smart contract wallets only exist on single chain.
      },
      onDisconnect() {
        config.emitter.emit("disconnect");
      },
      $filteredChains: filteredChains.changes,
      getTxStatus(txHash) {
        return Effect.tryPromise({
          try: () => sdk.txs.getBySafeTxHash(txHash),
          catch: (error) =>
            new Error("Could not get transaction status", { cause: error }),
        });
      },
      txStatus: TransactionStatus,
      sendTransactions(args) {
        return Effect.tryPromise({
          try: () => sdk.txs.send(args),
          catch: (error) =>
            new Error("Could not send transactions", { cause: error }),
        });
      },
    };
  });
}

export const safeConnector = (): WalletList[number] => ({
  groupName: "Safe Wallet",
  wallets: [
    () => ({
      id: configMeta.id,
      name: configMeta.name,
      iconUrl: "",
      iconBackground: "#fff",
      chainGroup: {
        id: configMeta.id,
        title: configMeta.name,
        iconUrl: "",
      },
      createConnector: () => safe({ shimDisconnect: true }),
    }),
  ],
});
