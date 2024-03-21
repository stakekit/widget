import { EitherAsync, Left } from "purify-ts";
import { getSKIcon } from "../../utils";
import { withRequestErrorRetry } from "../../common/utils";
import { useTransactionGetTransactionStatusByNetworkAndHashHook } from "@stakekit/api-hooks";
import { SupportedSKChains } from "./chains";
import { SKExternalProviders, SafeWalletAppInfo } from "./wallets/safe-wallet";

export class ExternalProvider {
  #safeWalletAppInfo: SafeWalletAppInfo = {
    description: "StakeKit",
    iconUrl: getSKIcon("sk-icon_320x320.png"),
    id: 0,
    name: "StakeKit",
    url: "https://stakek.it",
  };

  shouldMultiSend: boolean;

  constructor(
    private variant: SKExternalProviders,
    private transactionGetTransactionStatusByNetworkAndHash: ReturnType<
      typeof useTransactionGetTransactionStatusByNetworkAndHashHook
    >
  ) {
    this.shouldMultiSend = this.variant.type === "safe_wallet";
  }

  private invalidProviderType() {
    return EitherAsync.liftEither(Left(new Error("Invalid provider type")));
  }

  getAccount(): EitherAsync<Error, string> {
    switch (this.variant.type) {
      case "safe_wallet": {
        return EitherAsync(() => this.variant.provider.getAccounts())
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
    switch (this.variant.type) {
      case "safe_wallet": {
        return EitherAsync(() => this.variant.provider.getChainId())
          .mapLeft((e) => {
            console.error(e);
            return new Error("Failed to get chain id");
          })
          .map((val) => parseInt(val, 16));
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
    switch (this.variant.type) {
      case "safe_wallet": {
        return EitherAsync(() =>
          this.variant.provider.sendTransactions({
            txs,
            appInfo: this.#safeWalletAppInfo,
          })
        )
          .chain(({ hash }) =>
            withRequestErrorRetry({
              fn: async () => {
                const [safeRes, skRes] = await Promise.all([
                  this.variant.provider.getTransactionReceipt(hash),
                  this.transactionGetTransactionStatusByNetworkAndHash(
                    network,
                    hash
                  ),
                ]);

                console.log({ safeRes, skRes });

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
    switch (this.variant.type) {
      case "safe_wallet": {
        return EitherAsync(() =>
          this.variant.provider.switchEthereumChain(
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
      default:
        return this.invalidProviderType();
    }
  }
}
