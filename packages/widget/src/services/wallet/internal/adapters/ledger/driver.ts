import { Effect } from "effect";
import type { Connector } from "wagmi";
import type { WalletSwitchAccountInput } from "../../../wallet-commands";
import {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
  WalletDecodeError,
  WalletSwitchError,
} from "../../../wallet-errors";
import type {
  WalletBroadcastResult,
  WalletSignTransactionInput,
} from "../../../wallet-transactions";
import {
  isLedgerLiveConnector,
  type ExtraProps as LedgerConnectorExtraProps,
} from "./ledger-live-connector-meta";

const requireLedgerConnector = (
  connector: Connector
): Effect.Effect<
  Connector & LedgerConnectorExtraProps,
  WalletCapabilityUnavailableError
> =>
  isLedgerLiveConnector(connector)
    ? Effect.succeed(connector)
    : Effect.fail(
        new WalletCapabilityUnavailableError({
          capability: "transaction",
          connectorId: connector.id,
        })
      );

export const makeLedgerWalletDriver = ({
  connector,
  currentAccountId,
}: {
  readonly connector: Connector;
  readonly currentAccountId: string | undefined;
}) => ({
  signTransaction: (input: WalletSignTransactionInput) =>
    Effect.gen(function* () {
      const ledgerConnector = yield* requireLedgerConnector(connector);
      if (!currentAccountId) {
        return yield* new WalletCapabilityUnavailableError({
          capability: "transaction",
          connectorId: connector.id,
        });
      }

      const prepared = yield* ledgerConnector
        .prepareTransaction({
          network: input.network,
          tx: input.tx,
          txMeta: input.family === "classic" ? input.txMeta : undefined,
        })
        .pipe(Effect.mapError((cause) => new WalletDecodeError({ cause })));
      const deserializedTransaction = yield* Effect.try({
        try: () => ledgerConnector.deserializeTransaction(prepared),
        catch: (cause) => new WalletDecodeError({ cause }),
      });
      const signedTx = yield* Effect.tryPromise({
        try: () =>
          ledgerConnector.walletApiClient.transaction.signAndBroadcast(
            currentAccountId,
            deserializedTransaction,
            input.ledgerHwAppId ? { hwAppId: input.ledgerHwAppId } : undefined
          ),
        catch: (cause) =>
          new WalletBroadcastError({ cause, customMessage: null }),
      });

      return {
        broadcasted: true,
        signedTx: signedTx as string,
      } satisfies WalletBroadcastResult;
    }),
  switchAccount: ({ account }: WalletSwitchAccountInput) =>
    requireLedgerConnector(connector).pipe(
      Effect.flatMap((ledgerConnector) =>
        Effect.try({
          try: () => ledgerConnector.switchAccount(account),
          catch: (cause) =>
            new WalletSwitchError({
              cause,
              operation: "account",
              target: account.id,
            }),
        })
      )
    ),
});
