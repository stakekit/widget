import { EitherAsync, Left, Maybe, Right } from "purify-ts";
import type { RefObject } from "react";
import type { SKExternalProviders } from "./wallets";
import type { SKTx, SKTxMeta } from "./wallets/generic-wallet";

export class ExternalProvider {
  constructor(private variantProvider: RefObject<SKExternalProviders>) {}

  sendTransaction(tx: SKTx, txMeta: SKTxMeta) {
    return EitherAsync.liftEither(
      Maybe.fromNullable(
        this.variantProvider.current.provider.sendTransaction
      ).toEither(new Error("Invalid provider type"))
    )
      .chain((_sendTransaction) =>
        EitherAsync(() => _sendTransaction(tx, txMeta)).mapLeft(
          () => new Error("Failed to send transaction, unknown error")
        )
      )
      .chain((res) => {
        if (typeof res === "string") {
          return EitherAsync.liftEither(Right(res));
        }

        if (res.type === "success") {
          return EitherAsync.liftEither(Right(res.txHash));
        }

        return EitherAsync.liftEither(Left(res.error));
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
