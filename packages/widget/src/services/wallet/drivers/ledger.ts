import { Effect } from "effect";
import type { Connector } from "wagmi";
import {
  isLedgerLiveConnector,
  type ExtraProps as LedgerConnectorExtraProps,
} from "../connectors/ledger/ledger-live-connector-meta";
import type { WalletSwitchAccountInput } from "../domain/commands";
import {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
  WalletDecodeError,
  WalletSwitchError,
} from "../domain/errors";
import type {
  WalletBroadcastResult,
  WalletSignTransactionInput,
} from "../domain/transactions";

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
  signTransaction: ({
    ledgerHwAppId,
    network,
    tx,
    txMeta,
  }: WalletSignTransactionInput) =>
    Effect.gen(function* () {
      const ledgerConnector = yield* requireLedgerConnector(connector);
      if (!currentAccountId) {
        return yield* Effect.fail(
          new WalletCapabilityUnavailableError({
            capability: "transaction",
            connectorId: connector.id,
          })
        );
      }

      const prepared = yield* ledgerConnector
        .prepareTransaction({ network, tx, txMeta })
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
            ledgerHwAppId ? { hwAppId: ledgerHwAppId } : undefined
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
