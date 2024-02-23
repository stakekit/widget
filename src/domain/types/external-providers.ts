import { EitherAsync, Left } from "purify-ts";
import { getSKIcon } from "../../utils";
import { withRequestErrorRetry } from "../../common/utils";

export class ExternalProvider {
  safeWalletAppInfo: SafeWalletAppInfo = {
    description: "StakeKit",
    iconUrl: getSKIcon("sk-icon_320x320.png"),
    id: 0,
    name: "StakeKit",
    url: "https://stakek.it",
  };

  #provider: SKExternalProviders["provider"];
  #type: SKExternalProviders["type"];

  constructor(variant: SKExternalProviders) {
    this.#provider = variant.provider;
    this.#type = variant.type;
  }

  private invalidProviderType() {
    return EitherAsync.liftEither(Left(new Error("Invalid provider type")));
  }

  getAccount(): EitherAsync<Error, string> {
    switch (this.#type) {
      case "safe_wallet": {
        return EitherAsync(() => this.#provider.eth_accounts())
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
    switch (this.#type) {
      case "safe_wallet": {
        return EitherAsync(() => this.#provider.eth_chainId())
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

  sendTransaction(tx: {
    gas: string | number;
    to: string;
    value: string;
    data: string;
  }): EitherAsync<Error, string> {
    switch (this.#type) {
      case "safe_wallet": {
        return EitherAsync(() =>
          this.#provider.eth_sendTransaction(tx, this.safeWalletAppInfo)
        )
          .chain((val) =>
            withRequestErrorRetry({
              fn: async () => {
                const res = await this.#provider.eth_getTransactionReceipt(val);

                if (!res.blockHash || !res.transactionHash) {
                  throw new Error("Transaction not found");
                }

                return res.transactionHash;
              },
              shouldRetry: (_, retryCount) => retryCount < 8,
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
    switch (this.#type) {
      case "safe_wallet": {
        return EitherAsync(() =>
          this.#provider.wallet_switchEthereumChain(
            { chainId },
            this.safeWalletAppInfo
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

/**
 * Safe Wallet provider
 */
type SafeWalletAppInfo = {
  id: number;
  name: string;
  description: string;
  url: string;
  iconUrl: string;
};

export type SafeWalletTransactionReceipt = {
  hash?: string;
  transactionHash?: string;
  blockHash?: string;
};

interface SafeWalletProvider {
  eth_accounts(): Promise<string[]>;
  eth_chainId(): Promise<string>;
  eth_sendTransaction(
    tx: {
      gas: string | number;
      to: string;
      value: string;
      data: string;
    },
    appInfo: SafeWalletAppInfo
  ): Promise<string>;
  wallet_switchEthereumChain(
    { chainId }: { chainId: string },
    appInfo: SafeWalletAppInfo
  ): Promise<null>;
  eth_getTransactionReceipt(
    txHash: string
  ): Promise<SafeWalletTransactionReceipt>;
}

export type SKExternalProviders = {
  type: "safe_wallet";
  provider: SafeWalletProvider;
};
