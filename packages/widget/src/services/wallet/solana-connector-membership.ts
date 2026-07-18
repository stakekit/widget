import { WalletReadyState } from "@solana/wallet-adapter-base";
import { Effect, type Scope } from "effect";
import type { Config, Connector, CreateConnectorFn } from "wagmi";
import { disconnect, watchConnection } from "wagmi/actions";
import {
  isSolanaConnector,
  type SolanaConnector,
} from "./connectors/misc/solana-connector-meta";
import type {
  HeadlessSolanaRuntime,
  SolanaWalletDescriptor,
  SolanaWalletSnapshot,
} from "./solana-runtime";

type RainbowKitSolanaConnector = SolanaConnector & {
  readonly rkDetails: {
    readonly installed: boolean;
    readonly [key: string]: unknown;
  };
};

type SolanaConnectorMembershipOptions = {
  readonly config: Config;
  readonly createConnector: (
    wallet: SolanaWalletDescriptor
  ) => Promise<CreateConnectorFn>;
  readonly runtime: HeadlessSolanaRuntime;
};

const isRainbowKitSolanaConnector = (
  connector: Connector
): connector is RainbowKitSolanaConnector =>
  isSolanaConnector(connector) && "rkDetails" in connector;

const isInstalled = (wallet: SolanaWalletDescriptor) =>
  wallet.readyState === WalletReadyState.Installed ||
  wallet.readyState === WalletReadyState.Loadable;

const sameConnectors = (
  current: ReadonlyArray<Connector>,
  next: ReadonlyArray<Connector>
) =>
  current.length === next.length &&
  current.every((connector, index) => connector === next[index]);

export const installSolanaConnectorMembership = ({
  config,
  createConnector,
  runtime,
}: SolanaConnectorMembershipOptions): Effect.Effect<void, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const initialConnectors = config.connectors;
      const initialSolanaIndex = initialConnectors.findIndex(
        isRainbowKitSolanaConnector
      );
      const connectorCache = new Map<
        SolanaWalletDescriptor["adapter"],
        RainbowKitSolanaConnector
      >();
      let active = true;
      let latestSnapshot = runtime.getWalletSnapshot();
      let sequence = Promise.resolve();

      for (const connector of initialConnectors) {
        if (isRainbowKitSolanaConnector(connector)) {
          connectorCache.set(connector.solanaAdapter, connector);
        }
      }

      const currentSolanaConnectors = () =>
        config.connectors.filter(isRainbowKitSolanaConnector);

      const setupConnector = async (wallet: SolanaWalletDescriptor) => {
        const cached = connectorCache.get(wallet.adapter);
        if (cached) return cached;

        const connector = config._internal.connectors.setup(
          await createConnector(wallet)
        );
        if (!isRainbowKitSolanaConnector(connector)) {
          throw new Error(
            "Expected a Solana connector from membership factory"
          );
        }
        connectorCache.set(wallet.adapter, connector);
        return connector;
      };

      const refreshConnector = async (wallet: SolanaWalletDescriptor) => {
        const connector = await setupConnector(wallet);
        const installed = isInstalled(wallet);
        if (connector.rkDetails.installed === installed) return connector;

        const refreshed = {
          ...connector,
          rkDetails: {
            ...connector.rkDetails,
            installed,
          },
        } satisfies RainbowKitSolanaConnector;
        connectorCache.set(wallet.adapter, refreshed);
        return refreshed;
      };

      const publish = (solanaConnectors: ReadonlyArray<Connector>) => {
        const currentSolana = currentSolanaConnectors();
        if (sameConnectors(currentSolana, solanaConnectors)) return;

        config._internal.connectors.setState((current) => {
          const nonSolana = current.filter(
            (connector) => !isRainbowKitSolanaConnector(connector)
          );
          const insertionIndex =
            initialSolanaIndex < 0
              ? nonSolana.length
              : Math.min(initialSolanaIndex, nonSolana.length);
          return [
            ...nonSolana.slice(0, insertionIndex),
            ...solanaConnectors,
            ...nonSolana.slice(insertionIndex),
          ];
        });
      };

      const synchronize = async (snapshot: SolanaWalletSnapshot) => {
        if (!active) return;

        const current = currentSolanaConnectors();
        const currentByName = new Map(
          current.map((connector) => [connector.name, connector])
        );
        const desiredNames = new Set<string>(
          snapshot.wallets.map((wallet) => wallet.adapter.name as string)
        );
        const activeUids = new Set(config.state.connections.keys());
        const next: RainbowKitSolanaConnector[] = [];

        for (const wallet of snapshot.wallets) {
          const visible = currentByName.get(wallet.adapter.name);
          if (!visible || visible.solanaAdapter === wallet.adapter) {
            next.push(await refreshConnector(wallet));
            continue;
          }

          if (!activeUids.has(visible.uid)) {
            next.push(await refreshConnector(wallet));
            continue;
          }

          if (
            visible.solanaAdapterSource === "fallback" &&
            wallet.source === "standard"
          ) {
            next.push(visible);
            continue;
          }

          if (visible.solanaAdapterSource === "standard") {
            await disconnect(config, { connector: visible });
            next.push(await refreshConnector(wallet));
            continue;
          }

          next.push(visible);
        }

        for (const visible of current) {
          if (desiredNames.has(visible.name)) continue;
          if (
            activeUids.has(visible.uid) &&
            visible.solanaAdapterSource === "standard"
          ) {
            await disconnect(config, { connector: visible });
          } else if (activeUids.has(visible.uid)) {
            next.push(visible);
          }
        }

        publish(next);
      };

      const enqueue = (snapshot: SolanaWalletSnapshot) => {
        latestSnapshot = snapshot;
        sequence = sequence
          .then(
            () => synchronize(snapshot),
            () => synchronize(snapshot)
          )
          .catch(() => undefined);
        return sequence;
      };

      const unsubscribeRuntime = runtime.subscribe(() =>
        enqueue(runtime.getWalletSnapshot())
      );
      const unsubscribeConnection = watchConnection(config, {
        onChange: () => {
          void enqueue(latestSnapshot);
        },
      });
      void enqueue(latestSnapshot);

      return async () => {
        active = false;
        unsubscribeConnection();
        unsubscribeRuntime();
        await sequence;
        connectorCache.clear();
      };
    }),
    (dispose) => Effect.promise(dispose)
  ).pipe(Effect.asVoid);
