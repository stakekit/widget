import type { ActionDto, TransactionDto } from "@stakekit/api-hooks";
import { EitherAsync, Left } from "purify-ts";
import type { RefObject } from "react";
import type { SKExternalProviders } from "./wallets";
import type { EVMTx } from "./wallets/generic-wallet";

export class ExternalProvider {
  constructor(private variantProvider: RefObject<SKExternalProviders>) {}

  private invalidProviderType() {
    return EitherAsync.liftEither(Left(new Error("Invalid provider type")));
  }

  sendTransaction(
    tx: EVMTx,
    txMeta: { txId: TransactionDto["id"]; actionId: ActionDto["id"] }
  ) {
    const _sendTransaction =
      this.variantProvider.current.provider.sendTransaction;

    if (!_sendTransaction) {
      return this.invalidProviderType();
    }

    return EitherAsync(() => _sendTransaction(tx, txMeta)).mapLeft((e) => {
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
