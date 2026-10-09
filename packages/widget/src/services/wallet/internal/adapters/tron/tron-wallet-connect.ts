import { Effect, Predicate, Schema, SchemaTransformation } from "effect";
import { WalletIntegrationError } from "../../../wallet-errors";
import type {
  WalletConnectProtocol,
  WalletConnectSession,
} from "../../platform/wallet-connect-protocol";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import {
  type SignedTronTransaction,
  signedTronTransactionCodec,
  type UnsignedTronTransaction,
} from "./transaction";
import type { TronWallet } from "./tron-connector-meta";

/** CAIP-2 id of Tron mainnet, the only Tron network the widget configures. */
const mainnet = "tron:0x2b6653dc";

// Wallets answer with the signed transaction, bare or in a `result` envelope.
const SignTransactionResponse = Schema.Union([
  Schema.Struct({ result: signedTronTransactionCodec }).pipe(
    Schema.decodeTo(
      signedTronTransactionCodec,
      SchemaTransformation.transform({
        decode: ({ result }) => result,
        encode: (result) => ({ result }),
      })
    )
  ),
  signedTronTransactionCodec,
]);

const mainnetAddress = (session: WalletConnectSession) =>
  session.accounts
    .find((account) => account.startsWith(`${mainnet}:`))
    ?.slice(mainnet.length + 1);

type Connection = Readonly<{
  session: WalletConnectSession;
  address: string;
  unsubscribeEnded: () => void;
}>;

/** A Tron wallet reached through the shared WalletConnect protocol. */
export const makeTronWalletConnect = ({
  walletConnectProtocol: protocol,
  runWalletEffect,
}: {
  readonly walletConnectProtocol: WalletConnectProtocol;
  readonly runWalletEffect: RunWalletEffect;
}): TronWallet => {
  const endedListeners = new Set<() => void>();
  let connection: Connection | undefined;
  let attempt = 0;

  const restoredSession = protocol
    .sessions("tron")
    .pipe(
      Effect.map((sessions) =>
        sessions.find((session) => mainnetAddress(session) !== undefined)
      )
    );

  const release = () => {
    connection?.unsubscribeEnded();
    connection = undefined;
  };

  return {
    address: () => connection?.address ?? null,
    isAuthorized: () =>
      runWalletEffect(
        restoredSession.pipe(Effect.map(Predicate.isNotUndefined))
      ),
    connect: ({ isReconnecting }) => {
      const current = ++attempt;
      return runWalletEffect(
        Effect.gen(function* () {
          const session = yield* restoredSession.pipe(
            Effect.filterOrElse(Predicate.isNotUndefined, () =>
              isReconnecting
                ? Effect.fail(
                    new WalletIntegrationError({
                      message: "No Tron WalletConnect session to restore",
                      operation: "tron-reconnect",
                    })
                  )
                : protocol.connect({
                    namespace: "tron",
                    chains: [mainnet],
                    requiredMethods: [],
                    optionalMethods: [
                      "tron_signTransaction",
                      "tron_signMessage",
                    ],
                  })
            )
          );
          // A late approval after disconnect stays out of wallet state.
          if (current !== attempt) {
            return yield* new WalletIntegrationError({
              message: "Tron connection superseded",
              operation: "tron-connect",
            });
          }
          const address = mainnetAddress(session);
          if (address === undefined) {
            return yield* new WalletIntegrationError({
              message: "No Tron mainnet account approved",
              operation: "tron-connect",
            });
          }
          release();
          connection = {
            session,
            address,
            unsubscribeEnded: protocol.subscribeEnded(session.topic, () => {
              release();
              for (const listener of endedListeners) listener();
            }),
          };
        })
      );
    },
    disconnect: async () => {
      ++attempt;
      const topic = connection?.session.topic;
      release();
      if (topic) await runWalletEffect(protocol.disconnect(topic));
    },
    signTransaction: (transaction: UnsignedTronTransaction) =>
      runWalletEffect(
        Effect.gen(function* () {
          if (!connection) {
            return yield* new WalletIntegrationError({
              message: "Tron wallet is not connected",
              operation: "tron-sign-transaction",
            });
          }
          const { session, address } = connection;
          return yield* protocol.request({
            topic: session.topic,
            chainId: mainnet,
            method: "tron_signTransaction",
            params: {
              address,
              transaction:
                session.sessionProperties.tron_method_version === "v1"
                  ? transaction
                  : { transaction },
            },
            response: SignTransactionResponse,
          });
        })
      ) satisfies Promise<SignedTronTransaction>,
    onEnded: (listener) => {
      endedListeners.add(listener);
    },
  };
};
