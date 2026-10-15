import { Effect, Ref, type Scope, Semaphore, Stream } from "effect";
import type { Config, Connector, CreateConnectorFn } from "wagmi";
import { WalletIntegrationError } from "../../wallet-errors";
import {
  isSolanaConnector,
  type SolanaConnector,
} from "../adapters/solana/solana-connector-meta";
import type { SolanaRuntime } from "../platform/solana-platform";
import type { WagmiCoreObservation } from "../platform/wagmi-platform";
import type {
  SolanaWalletDescriptor,
  SolanaWalletSnapshot,
} from "./solana-runtime";
import type { WagmiActions } from "./wagmi-actions";

type DescribedSolanaConnector = SolanaConnector & {
  readonly walletDetails: unknown;
};

type SolanaConnectorMembershipOptions = {
  readonly actions: Pick<WagmiActions, "disconnect">;
  readonly config: Config;
  readonly core: WagmiCoreObservation;
  readonly createConnector: (
    wallet: SolanaWalletDescriptor
  ) => Effect.Effect<CreateConnectorFn, WalletIntegrationError>;
  readonly runtime: SolanaRuntime;
};

const isDescribedSolanaConnector = (
  connector: Connector
): connector is DescribedSolanaConnector =>
  isSolanaConnector(connector) && "walletDetails" in connector;

const sameConnectors = (
  current: ReadonlyArray<Connector>,
  next: ReadonlyArray<Connector>
) =>
  current.length === next.length &&
  current.every((connector, index) => connector === next[index]);

export const installSolanaConnectorMembership = Effect.fn(
  "installSolanaConnectorMembership"
)(function* ({
  config,
  core,
  createConnector,
  runtime,
  actions,
}: SolanaConnectorMembershipOptions): Effect.fn.Return<
  void,
  never,
  Scope.Scope
> {
  const initialConnectors = config.connectors;
  const initialSolanaIndex = initialConnectors.findIndex(
    isDescribedSolanaConnector
  );
  const initialCache = new Map<
    SolanaWalletDescriptor["adapter"],
    DescribedSolanaConnector
  >();
  for (const connector of initialConnectors) {
    if (isDescribedSolanaConnector(connector)) {
      initialCache.set(connector.solanaAdapter, connector);
    }
  }
  const connectorCache = yield* Ref.make(initialCache);
  const synchronizationPermit = yield* Semaphore.make(1);

  const setupConnector = Effect.fn("setupConnector")(function* (
    wallet: SolanaWalletDescriptor
  ) {
    const cached = (yield* Ref.get(connectorCache)).get(wallet.adapter);
    if (cached) return cached;

    const factory = yield* createConnector(wallet);
    const connector = yield* Effect.try(() =>
      config._internal.connectors.setup(factory)
    );
    if (!isDescribedSolanaConnector(connector)) {
      return yield* new WalletIntegrationError({
        message: "Expected a Solana connector from membership factory",
        operation: "solana-connector-membership",
      });
    }
    yield* Ref.update(connectorCache, (cache) => {
      const next = new Map(cache);
      next.set(wallet.adapter, connector);
      return next;
    });
    return connector;
  });

  const synchronize = Effect.fn("synchronize")(function* (
    snapshot: SolanaWalletSnapshot
  ) {
    const current = config.connectors.filter(isDescribedSolanaConnector);
    const currentByName = new Map(
      current.map((connector) => [connector.name, connector])
    );
    const desiredNames = new Set<string>(
      snapshot.wallets.map((wallet) => wallet.adapter.name as string)
    );
    const activeUids = new Set(config.state.connections.keys());
    const desired = yield* Effect.forEach(
      snapshot.wallets,
      Effect.fnUntraced(function* (wallet) {
        const visible = currentByName.get(wallet.adapter.name);
        if (!visible || visible.solanaAdapter === wallet.adapter) {
          return yield* setupConnector(wallet);
        }
        if (!activeUids.has(visible.uid)) {
          return yield* setupConnector(wallet);
        }
        if (
          visible.solanaAdapterSource === "fallback" &&
          wallet.source === "standard"
        ) {
          return visible;
        }
        if (visible.solanaAdapterSource === "standard") {
          yield* actions.disconnect({ connector: visible });
          return yield* setupConnector(wallet);
        }
        return visible;
      }),
      { concurrency: 1 }
    );
    const retained = yield* Effect.forEach(
      current,
      Effect.fnUntraced(function* (visible) {
        if (desiredNames.has(visible.name)) return [];
        if (
          activeUids.has(visible.uid) &&
          visible.solanaAdapterSource === "standard"
        ) {
          yield* actions.disconnect({ connector: visible });
          return [];
        }
        return activeUids.has(visible.uid) ? [visible] : [];
      }),
      { concurrency: 1 }
    ).pipe(Effect.map((groups) => groups.flat()));
    const next = [...desired, ...retained];
    if (sameConnectors(current, next)) return;

    yield* Effect.sync(() => {
      config._internal.connectors.setState((all) => {
        const nonSolana = all.filter(
          (connector) => !isDescribedSolanaConnector(connector)
        );
        const insertionIndex =
          initialSolanaIndex < 0
            ? nonSolana.length
            : Math.min(initialSolanaIndex, nonSolana.length);
        return [
          ...nonSolana.slice(0, insertionIndex),
          ...next,
          ...nonSolana.slice(insertionIndex),
        ];
      });
    });
  });

  const runSynchronization = Effect.fn("runSynchronization")(function* (
    snapshot: Parameters<typeof synchronize>[0]
  ) {
    yield* synchronizationPermit.withPermit(
      synchronize(snapshot).pipe(
        Effect.catch((cause) =>
          Effect.logWarning("Solana connector synchronization failed").pipe(
            Effect.annotateLogs({ cause })
          )
        )
      )
    );
  });

  yield* runtime.current.pipe(Effect.flatMap(runSynchronization));
  yield* runtime.states.pipe(
    Stream.runForEach(runSynchronization),
    Effect.forkScoped({ startImmediately: true })
  );
  yield* core.states.pipe(
    Stream.runForEach(() =>
      runtime.current.pipe(Effect.flatMap(runSynchronization))
    ),
    Effect.forkScoped({ startImmediately: true })
  );
});
