import {
  type Adapter,
  isWalletAdapterCompatibleStandardWallet,
  type WalletAdapter,
  WalletAdapterNetwork,
  WalletReadyState,
} from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  TrustWalletAdapter,
  WalletConnectWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { StandardWalletAdapter } from "@solana/wallet-standard-wallet-adapter-base";
import { type Cluster, Connection, clusterApiUrl } from "@solana/web3.js";
import {
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
  SolanaMobileWalletAdapter,
  SolanaMobileWalletAdapterWalletName,
} from "@solana-mobile/wallet-adapter-mobile";
import { getWallets, type Wallets } from "@wallet-standard/app";
import type { Wallet as StandardWallet } from "@wallet-standard/base";
import { Effect, type Scope } from "effect";
import { config } from "../../../../shared/config/widget-defaults";

export type SolanaWalletDescriptor = {
  readonly adapter: Adapter;
  readonly readyState: WalletReadyState;
  readonly source: "fallback" | "standard";
};

export type SolanaWalletSnapshot = {
  readonly wallets: ReadonlyArray<SolanaWalletDescriptor>;
};

export type HeadlessSolanaRuntime = {
  readonly connection: Connection;
  readonly getWalletSnapshot: () => SolanaWalletSnapshot;
  readonly subscribe: (listener: () => Promise<void> | void) => () => void;
};

type StandardAdapter = WalletAdapter & {
  readonly wallet: StandardWallet;
  readonly destroy: () => void;
};

type DisposableAdapter = Adapter & {
  readonly destroy?: () => void;
};

type SolanaRuntimeEnvironment = {
  readonly appIdentityUri: string | undefined;
  readonly userAgent: string | null;
};

type SolanaFallbackNetwork =
  | WalletAdapterNetwork.Mainnet
  | WalletAdapterNetwork.Devnet;

type HeadlessSolanaRuntimeDependencies = {
  readonly createConnection: (endpoint: string) => Connection;
  readonly createFallbackAdapters: (input: {
    readonly network: SolanaFallbackNetwork;
    readonly walletConnectProjectId: string;
  }) => ReadonlyArray<Adapter>;
  readonly createMobileAdapter: (input: {
    readonly appIdentityUri: string | undefined;
    readonly cluster: Cluster;
  }) => Adapter;
  readonly createStandardAdapter: (wallet: StandardWallet) => StandardAdapter;
  readonly environment: () => SolanaRuntimeEnvironment;
  readonly isCompatibleStandardWallet: (wallet: StandardWallet) => boolean;
  readonly registry: Wallets;
};

type HeadlessSolanaRuntimeOptions = {
  readonly endpoint?: string;
  readonly includeFallbackAdapters?: boolean;
  readonly includeWalletAdapters?: boolean;
  readonly network?: SolanaFallbackNetwork;
  readonly walletConnectProjectId?: string;
};

const inferCluster = (endpoint: string): Cluster => {
  if (/devnet/i.test(endpoint)) return "devnet";
  if (/testnet/i.test(endpoint)) return "testnet";
  return "mainnet-beta";
};

const isAndroidWebView = (userAgent: string) =>
  /(WebView|Version\/.+(Chrome)\/(\d+)\.(\d+)\.(\d+)\.(\d+)|; wv\).+(Chrome)\/(\d+)\.(\d+)\.(\d+)\.(\d+))/i.test(
    userAgent
  );

const shouldIncludeMobileAdapter = (
  adapters: ReadonlyArray<Adapter>,
  userAgent: string | null
) => {
  const hasInstalledAdapter = adapters.some(
    (adapter) =>
      adapter.name !== SolanaMobileWalletAdapterWalletName &&
      adapter.readyState === WalletReadyState.Installed
  );

  return (
    !hasInstalledAdapter &&
    userAgent !== null &&
    /android/i.test(userAgent) &&
    !isAndroidWebView(userAgent)
  );
};

const makeDefaultDependencies = (): HeadlessSolanaRuntimeDependencies => ({
  createConnection: (endpoint) =>
    new Connection(endpoint, { commitment: "confirmed" }),
  createFallbackAdapters: ({ network, walletConnectProjectId }) => [
    new PhantomWalletAdapter(),
    new TrustWalletAdapter(),
    new WalletConnectWalletAdapter({
      network,
      options: { projectId: walletConnectProjectId },
    }),
  ],
  createMobileAdapter: ({ appIdentityUri, cluster }) =>
    new SolanaMobileWalletAdapter({
      addressSelector: createDefaultAddressSelector(),
      appIdentity: { uri: appIdentityUri },
      authorizationResultCache: createDefaultAuthorizationResultCache(),
      cluster,
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    }),
  createStandardAdapter: (wallet) =>
    new StandardWalletAdapter({
      wallet: wallet as ConstructorParameters<
        typeof StandardWalletAdapter
      >[0]["wallet"],
    }),
  environment: () => ({
    appIdentityUri:
      typeof globalThis.location === "undefined"
        ? undefined
        : `${globalThis.location.protocol}//${globalThis.location.host}`,
    userAgent: globalThis.navigator?.userAgent ?? null,
  }),
  isCompatibleStandardWallet: isWalletAdapterCompatibleStandardWallet,
  registry: getWallets(),
});

const uniqueAdaptersByName = (
  standardAdapters: ReadonlyArray<Adapter>,
  fallbackAdapters: ReadonlyArray<Adapter>
) => {
  const names = new Set<string>();
  const adapters: Adapter[] = [];

  for (const adapter of [...standardAdapters, ...fallbackAdapters]) {
    if (names.has(adapter.name)) continue;
    names.add(adapter.name);
    adapters.push(adapter);
  }

  return adapters;
};

const snapshotsEqual = (
  left: SolanaWalletSnapshot,
  right: SolanaWalletSnapshot
) =>
  left.wallets.length === right.wallets.length &&
  left.wallets.every(
    (wallet, index) =>
      wallet === right.wallets[index] ||
      (wallet.adapter === right.wallets[index]?.adapter &&
        wallet.readyState === right.wallets[index]?.readyState &&
        wallet.source === right.wallets[index]?.source)
  );

const disposeAdapter = (adapter: Adapter) => {
  (adapter as DisposableAdapter).destroy?.();
};

const makeHeadlessSolanaRuntime = (
  options: HeadlessSolanaRuntimeOptions = {}
): Effect.Effect<HeadlessSolanaRuntime, never, Scope.Scope> =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const deps = makeDefaultDependencies();
      const network = options.network ?? WalletAdapterNetwork.Mainnet;
      const endpoint = options.endpoint ?? clusterApiUrl(network);
      const connection = deps.createConnection(endpoint);
      const fallbackAdapters =
        (options.includeWalletAdapters ?? true) &&
        (options.includeFallbackAdapters ?? true)
          ? deps.createFallbackAdapters({
              network,
              walletConnectProjectId:
                options.walletConnectProjectId ??
                config.walletConnectV2.projectId,
            })
          : [];
      const standardAdapters = new Map<StandardWallet, StandardAdapter>();
      const descriptorCache = new Map<Adapter, SolanaWalletDescriptor>();
      const adapterListeners = new Map<Adapter, () => void>();
      const listeners = new Set<() => Promise<void> | void>();
      const environment = deps.environment();
      let mobileAdapter: Adapter | null = null;
      let active = true;
      let snapshot: SolanaWalletSnapshot = Object.freeze({ wallets: [] });

      const getOrCreateDescriptor = (
        adapter: Adapter,
        source: SolanaWalletDescriptor["source"]
      ) => {
        const cached = descriptorCache.get(adapter);
        if (
          cached?.readyState === adapter.readyState &&
          cached.source === source
        ) {
          return cached;
        }

        const descriptor = Object.freeze({
          adapter,
          readyState: adapter.readyState,
          source,
        });
        descriptorCache.set(adapter, descriptor);
        return descriptor;
      };

      const publish = () => {
        if (!active) return [];

        const baseAdapters = uniqueAdaptersByName(
          [...standardAdapters.values()],
          fallbackAdapters
        );
        const existingMobileAdapter = baseAdapters.find(
          (adapter) => adapter.name === SolanaMobileWalletAdapterWalletName
        );
        const includeMobile = shouldIncludeMobileAdapter(
          baseAdapters,
          environment.userAgent
        );

        if (includeMobile && !existingMobileAdapter && !mobileAdapter) {
          mobileAdapter = deps.createMobileAdapter({
            appIdentityUri: environment.appIdentityUri,
            cluster: inferCluster(connection.rpcEndpoint),
          });
        }

        const visibleAdapters =
          includeMobile && !existingMobileAdapter && mobileAdapter
            ? [mobileAdapter, ...baseAdapters]
            : baseAdapters;
        const visibleSet = new Set(visibleAdapters);

        for (const [adapter, removeListener] of adapterListeners) {
          if (!visibleSet.has(adapter)) {
            removeListener();
            adapterListeners.delete(adapter);
          }
        }
        for (const adapter of visibleAdapters) {
          if (adapterListeners.has(adapter)) continue;
          const handleReadyStateChange = () => publish();
          adapter.on("readyStateChange", handleReadyStateChange);
          adapterListeners.set(adapter, () => {
            adapter.off("readyStateChange", handleReadyStateChange);
          });
        }

        const nextSnapshot = Object.freeze({
          wallets: Object.freeze(
            visibleAdapters
              .map((adapter) =>
                getOrCreateDescriptor(
                  adapter,
                  [...standardAdapters.values()].includes(
                    adapter as StandardAdapter
                  )
                    ? "standard"
                    : "fallback"
                )
              )
              .filter(
                ({ readyState }) => readyState !== WalletReadyState.Unsupported
              )
          ),
        });
        if (snapshotsEqual(snapshot, nextSnapshot)) return [];

        snapshot = nextSnapshot;
        return [...listeners].map((listener) => listener());
      };

      const addStandardWallets = (wallets: ReadonlyArray<StandardWallet>) => {
        for (const wallet of wallets) {
          if (
            standardAdapters.has(wallet) ||
            !deps.isCompatibleStandardWallet(wallet)
          ) {
            continue;
          }
          standardAdapters.set(wallet, deps.createStandardAdapter(wallet));
        }
        publish();
      };

      const removeStandardWallets = (
        wallets: ReadonlyArray<StandardWallet>
      ) => {
        const removedAdapters: StandardAdapter[] = [];
        for (const wallet of wallets) {
          const adapter = standardAdapters.get(wallet);
          if (!adapter) continue;

          adapterListeners.get(adapter)?.();
          adapterListeners.delete(adapter);
          descriptorCache.delete(adapter);
          standardAdapters.delete(wallet);
          removedAdapters.push(adapter);
        }
        const pending = publish().filter(
          (publication): publication is Promise<void> =>
            publication instanceof Promise
        );
        if (pending.length === 0) {
          for (const adapter of removedAdapters) adapter.destroy();
          return;
        }

        void Promise.allSettled(pending).then(() => {
          for (const adapter of removedAdapters) adapter.destroy();
        });
      };

      const includeWalletAdapters = options.includeWalletAdapters ?? true;
      const unregisterListeners = includeWalletAdapters
        ? [
            deps.registry.on("register", (...wallets) =>
              addStandardWallets(wallets)
            ),
            deps.registry.on("unregister", (...wallets) =>
              removeStandardWallets(wallets)
            ),
          ]
        : [];
      if (includeWalletAdapters) {
        addStandardWallets(deps.registry.get());
      } else {
        publish();
      }

      return {
        runtime: {
          connection,
          getWalletSnapshot: () => snapshot,
          subscribe: (listener) => {
            if (!active) return () => undefined;
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        } satisfies HeadlessSolanaRuntime,
        dispose: () => {
          if (!active) return;
          active = false;
          for (const unregister of unregisterListeners) unregister();
          for (const removeListener of adapterListeners.values()) {
            removeListener();
          }
          adapterListeners.clear();
          listeners.clear();

          for (const adapter of standardAdapters.values()) adapter.destroy();
          standardAdapters.clear();
          for (const adapter of fallbackAdapters) disposeAdapter(adapter);
          if (mobileAdapter) disposeAdapter(mobileAdapter);
          descriptorCache.clear();
        },
      };
    }),
    ({ dispose }) => Effect.sync(dispose)
  ).pipe(Effect.map(({ runtime }) => runtime));

export const makeDefaultHeadlessSolanaRuntime = (options?: {
  readonly includeWalletAdapters?: boolean;
}) =>
  makeHeadlessSolanaRuntime({
    includeFallbackAdapters: !config.env.isTestMode,
    includeWalletAdapters: options?.includeWalletAdapters,
  });
