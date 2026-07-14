import { Effect, Equal, Queue, Stream } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { Config } from "wagmi";
import { getConnection, watchConnection } from "wagmi/actions";

export type WalletConnectionSnapshot = ReturnType<typeof getConnection>;

export const disconnectedWalletConnection: WalletConnectionSnapshot = {
  address: undefined,
  addresses: undefined,
  chain: undefined,
  chainId: undefined,
  connector: undefined,
  isConnected: false,
  isConnecting: false,
  isDisconnected: true,
  isReconnecting: false,
  status: "disconnected",
};

export type WalletConnectionOperations = {
  readonly get: (config: Config) => WalletConnectionSnapshot;
  readonly watch: (
    config: Config,
    onChange: (snapshot: WalletConnectionSnapshot) => void
  ) => () => void;
};

const walletConnectionOperations: WalletConnectionOperations = {
  get: (config) => getConnection(config),
  watch: (config, onChange) => watchConnection(config, { onChange }),
};

export const makeWagmiConnectionStream = (
  wagmiConfig: Config,
  operations: WalletConnectionOperations = walletConnectionOperations
) =>
  Stream.callback<WalletConnectionSnapshot>(
    (queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          let active = true;
          let lastPublished: WalletConnectionSnapshot | undefined;
          let pendingBeforeSeed: WalletConnectionSnapshot | undefined;
          let seeded = false;
          const publish = (snapshot: WalletConnectionSnapshot) => {
            if (
              !active ||
              (lastPublished && Equal.equals(lastPublished, snapshot))
            ) {
              return;
            }

            lastPublished = snapshot;
            Queue.offerUnsafe(queue, snapshot);
          };
          const unsubscribe = operations.watch(wagmiConfig, (snapshot) => {
            if (seeded) publish(snapshot);
            else pendingBeforeSeed = snapshot;
          });

          publish(operations.get(wagmiConfig));
          seeded = true;
          if (pendingBeforeSeed) publish(pendingBeforeSeed);

          return () => {
            active = false;
            unsubscribe();
          };
        }),
        (dispose) => Effect.sync(dispose)
      ),
    { bufferSize: 16, strategy: "sliding" }
  );

export const makeWalletConnectionAtom = <E>(
  controllerAtom: Atom.Atom<
    AsyncResult.AsyncResult<{ readonly wagmiConfig: Config }, E>
  >
) =>
  Atom.make(
    (get) =>
      Stream.unwrap(
        get
          .result(controllerAtom)
          .pipe(
            Effect.map((controller) =>
              makeWagmiConnectionStream(controller.wagmiConfig)
            )
          )
      ),
    { initialValue: disconnectedWalletConnection }
  ).pipe(Atom.setIdleTTL(0));
