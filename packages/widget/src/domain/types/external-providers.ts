import { EitherAsync, Left } from "purify-ts";
import type { RefObject } from "react";
import type { SKExternalProviders } from "./wallets";
import type { SKTx, SKTxMeta } from "./wallets/generic-wallet";

export class ExternalProvider {
  constructor(private variantProvider: RefObject<SKExternalProviders>) {}

  private invalidProviderType() {
    return EitherAsync.liftEither(Left(new Error("Invalid provider type")));
  }

  sendTransaction(tx: SKTx, txMeta: SKTxMeta) {
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

  switchChain({ chainId }: { chainId: number }) {
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
