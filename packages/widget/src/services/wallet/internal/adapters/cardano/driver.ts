import { Effect } from "effect";
import type { Connector } from "wagmi";
import type {
  WalletCapabilityUnavailableError,
  WalletSigningError,
} from "../../../wallet-errors";
import type { WalletSignedPayloadResult } from "../../../wallet-transactions";
import {
  requireTransactionSigner,
  signedPayloadResult,
} from "../transaction-signing";
import { isCardanoConnector } from "./cardano-connector-meta";

export const makeCardanoWalletDriver = ({
  connector,
}: {
  readonly connector: Connector;
}) => ({
  signTransaction: ({
    tx,
  }: {
    readonly tx: string;
  }): Effect.Effect<
    WalletSignedPayloadResult,
    WalletCapabilityUnavailableError | WalletSigningError
  > =>
    requireTransactionSigner(
      connector,
      isCardanoConnector(connector) ? connector : null
    ).pipe(
      Effect.flatMap((cardano) =>
        signedPayloadResult(cardano.signTransaction(tx))
      )
    ),
});
