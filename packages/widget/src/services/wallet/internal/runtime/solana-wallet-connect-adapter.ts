import {
  BaseMessageSignerWalletAdapter,
  isVersionedTransaction,
  WalletAdapterNetwork,
  WalletConnectionError,
  WalletDisconnectionError,
  type WalletName,
  WalletNotConnectedError,
  WalletNotReadyError,
  WalletReadyState,
  WalletSignMessageError,
  WalletSignTransactionError,
} from "@solana/wallet-adapter-base";
import {
  PublicKey,
  Transaction,
  type TransactionVersion,
  VersionedTransaction,
} from "@solana/web3.js";
import base58 from "bs58";
import { Effect, Predicate, Schema } from "effect";
import type {
  WalletConnectProtocol,
  WalletConnectSession,
} from "../platform/wallet-connect-protocol";
import type { RunWalletEffect } from "./effect-runner";

const SignedTransaction = Schema.Union([
  Schema.Struct({ transaction: Schema.String }),
  Schema.Struct({ signature: Schema.String }),
]);
const Signature = Schema.Struct({ signature: Schema.String });
const SignedTransactions = Schema.Struct({
  transactions: Schema.Array(Schema.String),
});

const solanaMethods = [
  "solana_signTransaction",
  "solana_signMessage",
  "solana_signAllTransactions",
  "solana_signAndSendTransaction",
];

type Options = {
  readonly network: WalletAdapterNetwork.Mainnet | WalletAdapterNetwork.Devnet;
  readonly walletConnectProtocol: WalletConnectProtocol;
  readonly runWalletEffect: RunWalletEffect;
};

const serialize = (transaction: Transaction | VersionedTransaction) =>
  Buffer.from(
    isVersionedTransaction(transaction)
      ? transaction.serialize()
      : transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })
  ).toString("base64");

const deserialize = <T extends Transaction | VersionedTransaction>(
  serialized: string,
  original: T
): T => {
  const bytes = Buffer.from(serialized, "base64");
  // The request's transaction version determines the response's concrete type.
  return (
    isVersionedTransaction(original)
      ? VersionedTransaction.deserialize(bytes)
      : Transaction.from(bytes)
  ) as T;
};

export class WalletConnectSolanaAdapter extends BaseMessageSignerWalletAdapter {
  readonly name = "WalletConnect" as WalletName<"WalletConnect">;
  readonly url = "https://walletconnect.org";
  readonly icon =
    "data:image/svg+xml;base64,PHN2ZyBoZWlnaHQ9IjE4NSIgdmlld0JveD0iMCAwIDMwMCAxODUiIHdpZHRoPSIzMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0ibTYxLjQzODU0MjkgMzYuMjU2MjYxMmM0OC45MTEyMjQxLTQ3Ljg4ODE2NjMgMTI4LjIxMTk4NzEtNDcuODg4MTY2MyAxNzcuMTIzMjA5MSAwbDUuODg2NTQ1IDUuNzYzNDE3NGMyLjQ0NTU2MSAyLjM5NDQwODEgMi40NDU1NjEgNi4yNzY1MTEyIDAgOC42NzA5MjA0bC0yMC4xMzY2OTUgMTkuNzE1NTAzYy0xLjIyMjc4MSAxLjE5NzIwNTEtMy4yMDUzIDEuMTk3MjA1MS00LjQyODA4MSAwbC04LjEwMDU4NC03LjkzMTE0NzljLTM0LjEyMTY5Mi0zMy40MDc5ODE3LTg5LjQ0Mzg4Ni0zMy40MDc5ODE3LTEyMy41NjU1Nzg4IDBsLTguNjc1MDU2MiA4LjQ5MzYwNTFjLTEuMjIyNzgxNiAxLjE5NzIwNDEtMy4yMDUzMDEgMS4xOTcyMDQxLTQuNDI4MDgwNiAwbC0yMC4xMzY2OTQ5LTE5LjcxNTUwMzFjLTIuNDQ1NTYxMi0yLjM5NDQwOTItMi40NDU1NjEyLTYuMjc2NTEyMiAwLTguNjcwOTIwNHptMjE4Ljc2Nzc5NjEgNDAuNzczNzQ0OSAxNy45MjE2OTcgMTcuNTQ2ODk3YzIuNDQ1NTQ5IDIuMzk0Mzk2OSAyLjQ0NTU2MyA2LjI3NjQ3NjkuMDAwMDMxIDguNjcwODg5OWwtODAuODEwMTcxIDc5LjEyMTEzNGMtMi40NDU1NDQgMi4zOTQ0MjYtNi40MTA1ODIgMi4zOTQ0NTMtOC44NTYxNi4wMDAwNjItLjAwMDAxLS4wMDAwMS0uMDAwMDIyLS4wMDAwMjItLjAwMDAzMi0uMDAwMDMybC01Ny4zNTQxNDMtNTYuMTU0NTcyYy0uNjExMzktLjU5ODYwMi0xLjYwMjY1LS41OTg2MDItMi4yMTQwNCAwLS4wMDAwMDQuMDAwMDA0LS4wMDAwMDcuMDAwMDA4LS4wMDAwMTEuMDAwMDExbC01Ny4zNTI5MjEyIDU2LjE1NDUzMWMtMi40NDU1MzY4IDIuMzk0NDMyLTYuNDEwNTc1NSAyLjM5NDQ3Mi04Ljg1NjE2MTIuMDAwMDg3LS4wMDAwMTQzLS4wMDAwMTQtLjAwMDAyOTYtLjAwMDAyOC0uMDAwMDQ0OS0uMDAwMDQ0bC04MC44MTI0MTk0My03OS4xMjIxODVjLTIuNDQ1NTYwMjEtMi4zOTQ0MDgtMi40NDU1NjAyMS02LjI3NjUxMTUgMC04LjY3MDkxOTdsMTcuOTIxNzI5NjMtMTcuNTQ2ODY3M2MyLjQ0NTU2MDItMi4zOTQ0MDgyIDYuNDEwNTk4OS0yLjM5NDQwODIgOC44NTYxNjAyIDBsNTcuMzU0OTc3NSA1Ni4xNTUzNTdjLjYxMTM5MDguNTk4NjAyIDEuNjAyNjQ5LjU5ODYwMiAyLjIxNDAzOTggMCAuMDAwMDA5Mi0uMDAwMDA5LjAwMDAxNzQtLjAwMDAxNy4wMDAwMjY1LS4wMDAwMjRsNTcuMzUyMTAzMS01Ni4xNTUzMzNjMi40NDU1MDUtMi4zOTQ0NjMzIDYuNDEwNTQ0LTIuMzk0NTUzMSA4Ljg1NjE2MS0uMDAwMi4wMDAwMzQuMDAwMDMzNi4wMDAwNjguMDAwMDY3My4wMDAxMDEuMDAwMTAxbDU3LjM1NDkwMiA1Ni4xNTU0MzJjLjYxMTM5LjU5ODYwMSAxLjYwMjY1LjU5ODYwMSAyLjIxNDA0IDBsNTcuMzUzOTc1LTU2LjE1NDMyNDljMi40NDU1NjEtMi4zOTQ0MDkyIDYuNDEwNTk5LTIuMzk0NDA5MiA4Ljg1NjE2IDB6IiBmaWxsPSIjM2I5OWZjIi8+PC9zdmc+";
  readonly supportedTransactionVersions: ReadonlySet<TransactionVersion> =
    new Set(["legacy", 0]);
  readonly readyState =
    typeof window === "undefined"
      ? WalletReadyState.Unsupported
      : WalletReadyState.Loadable;

  private key: PublicKey | null = null;
  private session: WalletConnectSession | undefined;
  private chainId: string | undefined;
  private connectingPromise: Promise<void> | undefined;
  private unsubscribeEnded: (() => void) | undefined;
  private attempt = 0;
  private disposed = false;
  private readonly endedListeners = new Set<() => void>();

  constructor(private readonly options: Options) {
    super();
  }

  get publicKey() {
    return this.key;
  }

  /**
   * Calls `listener` when the wallet deletes or expires the selected session,
   * unlike the `disconnect` event, which a local disconnect emits too.
   */
  subscribeEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => {
      this.endedListeners.delete(listener);
    };
  }

  get connecting() {
    return this.connectingPromise !== undefined;
  }

  private get chains(): readonly [string, ...string[]] {
    return this.options.network === WalletAdapterNetwork.Mainnet
      ? [
          "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
          "solana:4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ",
        ]
      : [
          "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
          "solana:8E9rvCKLFQia2Y35HXjjpWzj8weVo44K",
        ];
  }

  /** The first account on a configured chain whose address is a public key. */
  private account(session: WalletConnectSession) {
    for (const chainId of this.chains) {
      for (const account of session.accounts) {
        if (!account.startsWith(`${chainId}:`)) continue;
        const bytes = base58.decodeUnsafe(account.slice(chainId.length + 1));
        if (bytes?.length === 32) {
          return { chainId, publicKey: new PublicKey(bytes) };
        }
      }
    }
    return undefined;
  }

  private restoredSession() {
    return this.options.walletConnectProtocol
      .sessions("solana")
      .pipe(
        Effect.map((sessions) =>
          sessions.find((session) => this.account(session) !== undefined)
        )
      );
  }

  private release() {
    this.unsubscribeEnded?.();
    this.unsubscribeEnded = undefined;
    this.session = undefined;
    this.chainId = undefined;
    this.key = null;
  }

  connect(): Promise<void> {
    if (this.disposed || this.readyState !== WalletReadyState.Loadable) {
      return Promise.reject(new WalletNotReadyError());
    }
    if (this.connected) return Promise.resolve();
    if (this.connectingPromise) return this.connectingPromise;
    const attempt = ++this.attempt;
    const protocol = this.options.walletConnectProtocol;
    this.connectingPromise = this.options
      .runWalletEffect(
        this.restoredSession().pipe(
          Effect.filterOrElse(Predicate.isNotUndefined, () =>
            protocol.connect({
              namespace: "solana",
              chains: this.chains,
              requiredMethods: [],
              optionalMethods: solanaMethods,
            })
          )
        )
      )
      .then((session) => {
        // A late approval after disconnect/destroy stays out of adapter state.
        if (this.disposed || attempt !== this.attempt) {
          throw new WalletNotConnectedError();
        }
        const account = this.account(session);
        if (!account)
          throw new WalletConnectionError("No Solana account approved");
        this.release();
        this.session = session;
        this.chainId = account.chainId;
        this.key = account.publicKey;
        this.unsubscribeEnded = protocol.subscribeEnded(session.topic, () => {
          this.release();
          this.emit("disconnect");
          for (const listener of [...this.endedListeners]) listener();
        });
        this.emit("connect", account.publicKey);
      })
      .finally(() => {
        if (attempt === this.attempt) this.connectingPromise = undefined;
      });
    return this.connectingPromise;
  }

  override async autoConnect(): Promise<void> {
    if (this.disposed) throw new WalletNotReadyError();
    if (await this.options.runWalletEffect(this.restoredSession())) {
      await this.connect();
    }
  }

  async disconnect(): Promise<void> {
    ++this.attempt;
    this.connectingPromise = undefined;
    const topic = this.session?.topic;
    this.release();
    try {
      if (topic) {
        await this.options.runWalletEffect(
          this.options.walletConnectProtocol.disconnect(topic)
        );
      }
    } catch (cause) {
      this.emit(
        "error",
        new WalletDisconnectionError(
          cause instanceof Error ? cause.message : undefined,
          cause
        )
      );
    } finally {
      this.emit("disconnect");
    }
  }

  private supports(method: string) {
    return this.session?.methods.includes(method) ?? false;
  }

  private request<A>(
    method: string,
    params: unknown,
    response: Schema.Decoder<A>
  ): Promise<A> {
    if (!this.session || !this.chainId || !this.key) {
      throw new WalletNotConnectedError();
    }
    if (!this.supports(method))
      throw new Error(`Wallet does not support ${method}`);
    return this.options.runWalletEffect(
      this.options.walletConnectProtocol.request({
        topic: this.session.topic,
        chainId: this.chainId,
        method,
        params,
        response,
      })
    );
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T> {
    try {
      const publicKey = this.key;
      if (!publicKey) throw new WalletNotConnectedError();
      const response = await this.request(
        "solana_signTransaction",
        {
          ...(isVersionedTransaction(transaction) ? {} : transaction),
          transaction: serialize(transaction),
        },
        SignedTransaction
      );
      if ("transaction" in response)
        return deserialize(response.transaction, transaction);
      transaction.addSignature(
        publicKey,
        Buffer.from(base58.decode(response.signature))
      );
      return transaction;
    } catch (cause) {
      return this.signingError(cause);
    }
  }

  override async signAllTransactions<
    T extends Transaction | VersionedTransaction,
  >(transactions: T[]): Promise<T[]> {
    if (!this.key) return this.signingError(new WalletNotConnectedError());
    if (!this.supports("solana_signAllTransactions")) {
      return Promise.all(
        transactions.map((transaction) => this.signTransaction(transaction))
      );
    }
    try {
      const response = await this.request(
        "solana_signAllTransactions",
        { transactions: transactions.map(serialize) },
        SignedTransactions
      );
      if (response.transactions.length !== transactions.length) {
        throw new Error(
          "Wallet returned a different number of signed transactions"
        );
      }
      return transactions.map((transaction, index) =>
        deserialize(response.transactions[index]!, transaction)
      );
    } catch (cause) {
      return this.signingError(cause);
    }
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    try {
      if (!this.key) throw new WalletNotConnectedError();
      const response = await this.request(
        "solana_signMessage",
        { pubkey: this.key.toBase58(), message: base58.encode(message) },
        Signature
      );
      return base58.decode(response.signature);
    } catch (cause) {
      const error =
        cause instanceof WalletNotConnectedError
          ? cause
          : new WalletSignMessageError(
              cause instanceof Error ? cause.message : undefined,
              cause
            );
      this.emit("error", error);
      throw error;
    }
  }

  async signAndSendTransaction(
    transaction: Transaction | VersionedTransaction
  ): Promise<string> {
    try {
      const response = await this.request(
        "solana_signAndSendTransaction",
        { transaction: serialize(transaction) },
        Signature
      );
      return response.signature;
    } catch (cause) {
      return this.signingError(cause);
    }
  }

  private signingError(cause: unknown): never {
    const error =
      cause instanceof WalletNotConnectedError
        ? cause
        : new WalletSignTransactionError(
            cause instanceof Error ? cause.message : undefined,
            cause
          );
    this.emit("error", error);
    throw error;
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    ++this.attempt;
    this.connectingPromise = undefined;
    this.release();
    this.removeAllListeners();
    this.endedListeners.clear();
    // Persisted sessions belong to the shared WalletConnect protocol.
  }
}
