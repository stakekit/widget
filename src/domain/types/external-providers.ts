import { EitherAsync, Left } from "purify-ts";
import { withRequestErrorRetry } from "../../common/utils";
import {
  TransactionStatus,
  useTransactionGetTransactionStatusByNetworkAndHashHook,
} from "@stakekit/api-hooks";
import { SupportedSKChains } from "./chains";
import { MutableRefObject } from "react";
import { SKExternalProviders } from "./wallets";
import { EVMTx } from "./wallets/generic-wallet";

export class ExternalProvider {
  get shouldMultiSend() {
    return !!this.variant.current.provider.sendTransactions;
  }

  private txStatusesToContinue = new Set<TransactionStatus>([
    "CREATED",
    "CONFIRMED",
    "BROADCASTED",
  ]);

  constructor(
    private variant: MutableRefObject<SKExternalProviders>,
    private transactionGetTransactionStatusByNetworkAndHash: ReturnType<
      typeof useTransactionGetTransactionStatusByNetworkAndHashHook
    >
  ) {}

  private invalidProviderType() {
    return EitherAsync.liftEither(Left(new Error("Invalid provider type")));
  }

  getAccount() {
    return EitherAsync(() => this.variant.current.provider.getAccounts())
      .map((accounts) => accounts[0])
      .mapLeft((e) => {
        console.error(e);
        return new Error("Failed to get account");
      });
  }

  getChainId() {
    return EitherAsync(() =>
      this.variant.current.provider.getChainId()
    ).mapLeft((e) => {
      console.error(e);
      return new Error("Failed to get chain id");
    });
  }

  sendTransaction(tx: EVMTx) {
    const sendTransaction = this.variant.current.provider.sendTransaction;

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
    const sendTransactions = this.variant.current.provider.sendTransactions;

    if (!sendTransactions) return this.invalidProviderType();

    return EitherAsync(() => sendTransactions(txs))
      .chain((hash) =>
        withRequestErrorRetry({
          fn: async () => {
            const [providerRes, skRes] = await Promise.all([
              this.variant.current.provider
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
      this.variant.current.provider.switchChain(chainId)
    ).mapLeft((e) => {
      console.error(e);
      return new Error("Failed to switch chain");
    });
  }

  signMessage(messageHash: string) {
    return EitherAsync(() =>
      this.variant.current.provider.signMessage(messageHash)
    ).mapLeft((e) => {
      console.error(e);
      return new Error("Failed to sign message");
    });
  }
}
