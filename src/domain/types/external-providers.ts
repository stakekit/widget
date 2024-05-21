import type {
  TransactionStatus,
  useTransactionGetTransactionStatusByNetworkAndHashHook,
} from "@stakekit/api-hooks";
import { EitherAsync, Left } from "purify-ts";
import type { MutableRefObject } from "react";
import { withRequestErrorRetry } from "../../common/utils";
import type { SupportedSKChains } from "./chains";
import type { SKExternalProviders } from "./wallets";
import type { EVMTx } from "./wallets/generic-wallet";

export class ExternalProvider {
  get shouldMultiSend() {
    return !!this.variantProvider.current.provider.sendTransactions;
  }

  private txStatusesToContinue = new Set<TransactionStatus>([
    "CREATED",
    "CONFIRMED",
    "BROADCASTED",
  ]);

  constructor(
    private variantProvider: MutableRefObject<SKExternalProviders>,
    private transactionGetTransactionStatusByNetworkAndHash: ReturnType<
      typeof useTransactionGetTransactionStatusByNetworkAndHashHook
    >
  ) {}

  private invalidProviderType() {
    return EitherAsync.liftEither(Left(new Error("Invalid provider type")));
  }

  sendTransaction(tx: EVMTx) {
    const sendTransaction =
      this.variantProvider.current.provider.sendTransaction;

    if (!sendTransaction) {
      return this.invalidProviderType();
    }

    return EitherAsync(() => sendTransaction(tx)).mapLeft((e) => {
      console.log(e);
      return new Error("Failed to send transaction");
    });
  }

  sendMultipleTransactions({
    network,
    txs,
  }: {
    network: SupportedSKChains;
    txs: EVMTx[];
  }) {
    const sendTransactions =
      this.variantProvider.current.provider.sendTransactions;

    if (!sendTransactions) return this.invalidProviderType();

    return EitherAsync(() => sendTransactions(txs))
      .chain((hash) =>
        withRequestErrorRetry({
          fn: async () => {
            const [providerRes, skRes] = await Promise.all([
              this.variantProvider.current.provider
                .getTransactionReceipt?.(hash)
                .catch(() => null),
              this.transactionGetTransactionStatusByNetworkAndHash(
                network,
                hash
              ).catch(() => null),
            ]);

            if (providerRes?.transactionHash) {
              return providerRes.transactionHash;
            }

            if (
              skRes &&
              this.txStatusesToContinue.has(skRes.status) &&
              skRes.hash
            ) {
              return skRes.hash;
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

  switchChain({ chainId }: { chainId: string }) {
    return EitherAsync(() =>
      this.variantProvider.current.provider.switchChain(chainId)
    ).mapLeft((e) => {
      console.error(e);
      return new Error("Failed to switch chain");
    });
  }

  signMessage(messageHash: string) {
    return EitherAsync(() =>
      this.variantProvider.current.provider.signMessage(messageHash)
    ).mapLeft((e) => {
      console.error(e);
      return new Error("Failed to sign message");
    });
  }
}
