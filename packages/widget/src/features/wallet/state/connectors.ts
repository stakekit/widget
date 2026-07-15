import { Effect, Equal, Queue, Stream } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { Config } from "wagmi";
import { getConnectors, watchConnectors } from "wagmi/actions";

export type WalletConnectorsSnapshot = ReturnType<typeof getConnectors>;

export const disconnectedWalletConnectors: WalletConnectorsSnapshot = [];

export type WalletConnectorsOperations = {
  readonly get: (config: Config) => WalletConnectorsSnapshot;
  readonly watch: (
    config: Config,
    onChange: (snapshot: WalletConnectorsSnapshot) => void
  ) => () => void;
};

const walletConnectorsOperations: WalletConnectorsOperations = {
  get: (config) => getConnectors(config),
  watch: (config, onChange) => watchConnectors(config, { onChange }),
};

export const makeWagmiConnectorsStream = (
  wagmiConfig: Config,
  operations: WalletConnectorsOperations = walletConnectorsOperations
) =>
  Stream.callback<WalletConnectorsSnapshot>(
    (queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          let active = true;
          let lastPublished: WalletConnectorsSnapshot | undefined;
          let pendingBeforeSeed: WalletConnectorsSnapshot | undefined;
          let seeded = false;
          const publish = (snapshot: WalletConnectorsSnapshot) => {
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

export const makeWalletConnectorsAtom = <E>(
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
              makeWagmiConnectorsStream(controller.wagmiConfig)
            )
          )
      ),
    { initialValue: disconnectedWalletConnectors }
  ).pipe(Atom.setIdleTTL(0));
