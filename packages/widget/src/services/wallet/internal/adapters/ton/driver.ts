import { Effect } from "effect";
import type { Connector } from "wagmi";
import type {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
} from "../../../wallet-errors";
import type { WalletBroadcastResult } from "../../../wallet-transactions";
import {
  broadcastResult,
  requireTransactionSigner,
} from "../transaction-signing";
import { isTonConnector } from "./ton-connector-meta";

export const makeTonWalletDriver = ({
  connector,
}: {
  readonly connector: Connector;
}) => ({
  signTransaction: ({
    tx,
  }: {
    readonly tx: string;
  }): Effect.Effect<
    WalletBroadcastResult,
    WalletBroadcastError | WalletCapabilityUnavailableError
  > =>
    requireTransactionSigner(
      connector,
      isTonConnector(connector) ? connector : null
    ).pipe(Effect.flatMap((ton) => broadcastResult(ton.signTransaction(tx)))),
});
