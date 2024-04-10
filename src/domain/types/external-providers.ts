import { EitherAsync, Left } from "purify-ts";
import { withRequestErrorRetry } from "../../common/utils";
import { useTransactionGetTransactionStatusByNetworkAndHashHook } from "@stakekit/api-hooks";
import { SupportedSKChains } from "./chains";
import { MutableRefObject } from "react";
import { config } from "../../config";
import { SKExternalProviders } from "./wallets";
import { SafeWalletAppInfo } from "./wallets/safe-wallet";
import { EVMTx } from "./wallets/generic-wallet";

export class ExternalProvider {
  #safeWalletAppInfo: SafeWalletAppInfo = {
    description: config.appName,
    iconUrl: config.appIcon,
    id: 0,
    name: config.appName,
    url: config.appUrl,
  };

  get shouldMultiSend() {
    return this.variant.current.type === "safe_wallet";
  }

  constructor(
    private variant: MutableRefObject<SKExternalProviders>,
    private transactionGetTransactionStatusByNetworkAndHash: ReturnType<
      typeof useTransactionGetTransactionStatusByNetworkAndHashHook
    >
  ) {}

  private invalidProviderType() {
    return EitherAsync.liftEither(Left(new Error("Invalid provider type")));
  }

  getAccount(): EitherAsync<Error, string> {
    switch (this.variant.current.type) {
      case "safe_wallet":
      case "generic": {
        return EitherAsync(() => this.variant.current.provider.getAccounts())
          .map((accounts) => accounts[0])
          .mapLeft((e) => {
            console.error(e);
            return new Error("Failed to get account");
          });
      }

      default:
        return this.invalidProviderType();
    }
  }

  getChainId(): EitherAsync<Error, number> {
    return EitherAsync<Error, number | string>(() =>
      this.variant.current.provider.getChainId()
    )
      .mapLeft((e) => {
        console.error(e);
        return new Error("Failed to get chain id");
      })
      .map((val) => (typeof val === "string" ? parseInt(val, 16) : val));
  }

  sendTransaction(tx: EVMTx) {
    const currentVariant = this.variant.current;

    switch (currentVariant.type) {
      case "generic": {
        return EitherAsync(() =>
          currentVariant.provider.sendTransaction(tx)
        ).mapLeft((e) => {
          console.log(e);
          return new Error("Failed to send transaction");
        });
      }

      default:
        return this.invalidProviderType();
    }
  }

  sendMultipleTransactions({
    network,
    txs,
  }: {
    network: SupportedSKChains;
    txs: {
      gas: string | number;
      to: string;
      value: string;
      data: string;
    }[];
  }): EitherAsync<Error, string> {
    const currentVariant = this.variant.current;

    switch (currentVariant.type) {
      case "safe_wallet": {
        return EitherAsync(() =>
          currentVariant.provider.sendTransactions({
            txs,
            appInfo: this.#safeWalletAppInfo,
          })
        )
          .chain(({ hash }) =>
            withRequestErrorRetry({
              fn: async () => {
                const [safeRes, skRes] = await Promise.all([
                  currentVariant.provider.getTransactionReceipt(hash),
                  this.transactionGetTransactionStatusByNetworkAndHash(
                    network,
                    hash
                  ),
                ]);

                if (
                  safeRes?.transactionHash ||
                  (skRes.status === "CONFIRMED" && skRes.hash)
                ) {
                  return safeRes?.transactionHash || skRes.hash;
                }

                throw new Error("Transaction not found");
              },
              // TODO: add cancelation!!!
              shouldRetry: (_, retryCount) => retryCount < 120,
              retryWaitForMs: () => 7000,
            })
          )
          .mapLeft((e) => {
            console.log(e);
            return new Error("Failed to send transaction");
          });
      }
      default:
        return this.invalidProviderType();
    }
  }

  switchChain({ chainId }: { chainId: string }): EitherAsync<Error, void> {
    const currentVariant = this.variant.current;

    switch (currentVariant.type) {
      case "safe_wallet": {
        return EitherAsync(() =>
          currentVariant.provider.switchEthereumChain(
            { chainId },
            this.#safeWalletAppInfo
          )
        )
          .mapLeft((e) => {
            console.log(e);
            return new Error("Failed to switch chain");
          })
          .void();
      }

      case "generic": {
        return EitherAsync(() =>
          currentVariant.provider.switchChain(chainId)
        ).mapLeft((e) => {
          console.error(e);
          return new Error("Failed to switch chain");
        });
      }

      default:
        return this.invalidProviderType();
    }
  }

  signMessage(address: string, messageHash: string) {
    const currentVariant = this.variant.current;

    switch (currentVariant.type) {
      case "safe_wallet": {
        return EitherAsync(() =>
          currentVariant.provider.signMessage(
            address,
            messageHash,
            this.#safeWalletAppInfo
          )
        ).mapLeft((e) => {
          console.error(e);
          return new Error("Failed to sign message");
        });
      }

      case "generic": {
        return EitherAsync(() =>
          currentVariant.provider.signMessage(messageHash)
        ).mapLeft((e) => {
          console.error(e);
          return new Error("Failed to sign message");
        });
      }

      default:
        return this.invalidProviderType();
    }
  }
}
