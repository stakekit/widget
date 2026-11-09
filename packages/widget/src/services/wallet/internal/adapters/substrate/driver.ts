import { Effect, Schema } from "effect";
import type { Connector } from "wagmi";

import { WalletDecodeError } from "../../../wallet-errors";
import {
  requireTransactionSigner,
  signedPayloadResult,
} from "../transaction-signing";
import { isSubstrateConnector } from "./substrate-connector-meta";
import { substratePayloadCodec } from "./transaction";

export const makeSubstrateWalletDriver = ({
  connector,
}: {
  readonly connector: Connector;
}) => ({
  signTransaction: ({ tx }: { readonly tx: string }) =>
    Effect.gen(function* () {
      const substrate = yield* requireTransactionSigner(
        connector,
        isSubstrateConnector(connector) ? connector : null
      );
      const payload = yield* Schema.decodeEffect(
        Schema.fromJsonString(substratePayloadCodec)
      )(tx).pipe(Effect.mapError((cause) => new WalletDecodeError({ cause })));

      return yield* signedPayloadResult(
        substrate.signTransaction({
          ...payload,
          rawTx: tx,
          tx: {
            ...payload.tx,
            signedExtensions: [...payload.tx.signedExtensions],
          },
        })
      );
    }),
});
