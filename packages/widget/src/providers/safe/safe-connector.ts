import { SafeAppProvider } from "@safe-global/safe-apps-provider";
import SafeSDK, { TransactionStatus } from "@safe-global/safe-apps-sdk";
import {
  type ExtraProps,
  configMeta,
} from "@sk-widget/providers/safe/safe-connector-meta";
import { isIframe } from "@sk-widget/utils";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import { EitherAsync, Maybe } from "purify-ts";
import { BehaviorSubject } from "rxjs";
import { getAddress, withTimeout } from "viem";
import { ProviderNotFoundError } from "wagmi";
import { type Connector, createConnector } from "wagmi";

function safe(
  parameters: {
    shimDisconnect?: boolean;
  } = {}
) {
  const { shimDisconnect = false } = parameters;

  type Provider = SafeAppProvider | undefined;
  type StorageItem = { "safe.disconnected": true };

  let provider_: Provider | undefined;

  let disconnect: Connector["onDisconnect"] | undefined;

  return createConnector<Provider, ExtraProps, StorageItem>((config) => {
    const $filteredChains = new BehaviorSubject<Chain[]>([]);
    const sdk = new SafeSDK();

    return {
      id: configMeta.id,
      name: configMeta.name,
      type: configMeta.type,
      async connect() {
        const provider = await this.getProvider();
        if (!provider) throw new ProviderNotFoundError();

        const accounts = await this.getAccounts();
        const chainId = await this.getChainId();
        $filteredChains.next(
          Maybe.fromNullable(config.chains.find((c) => c.id === chainId))
            .map((c) => [c])
            .orDefault([])
        );

        if (!disconnect) {
          disconnect = this.onDisconnect.bind(this);
          provider.on("disconnect", disconnect);
        }

        // Remove disconnected shim if it exists
        if (shimDisconnect)
          await config.storage?.removeItem("safe.disconnected");

        return { accounts, chainId };
      },
      async disconnect() {
        const provider = await this.getProvider();
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
        const provider = await this.getProvider();
        if (!provider) throw new ProviderNotFoundError();
        return (await provider.request({ method: "eth_accounts" })).map(
          getAddress
        );
      },
      async getProvider() {
        // Only allowed in iframe context
        if (!isIframe()) return;

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
        const provider = await this.getProvider();
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
      $filteredChains,
      getTxStatus(txHash) {
        return EitherAsync(() => sdk.txs.getBySafeTxHash(txHash)).mapLeft(
          () => new Error("Could not get transaction status")
        );
      },
      txStatus: TransactionStatus,
      sendTransactions(args) {
        return EitherAsync(() => sdk.txs.send(args)).mapLeft(
          () => new Error("Could not send transactions")
        );
      },
    };
  });
}

export const safeConnector = (): WalletList[number] => ({
  groupName: "Ledger Live",
  wallets: [
    () => ({
      id: configMeta.id,
      name: configMeta.name,
      iconUrl: "",
      iconBackground: "#fff",
      createConnector: () => safe({ shimDisconnect: true }),
    }),
  ],
});
