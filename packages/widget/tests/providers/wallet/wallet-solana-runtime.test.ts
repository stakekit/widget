import {
  type Adapter,
  type WalletName,
  WalletReadyState,
} from "@solana/wallet-adapter-base";
import { Connection } from "@solana/web3.js";
import { Effect, Fiber, Layer, Option, Stream } from "effect";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createConfig, createConnector, http } from "wagmi";
import {
  getConnection,
  getConnectors,
  watchConnection,
  watchConnectors,
} from "wagmi/actions";
import { normalizeWidgetConfig } from "../../../src/app/config";
import { solana } from "../../../src/domain/types/chains/misc";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import { WidgetPersistence } from "../../../src/services/persistence/widget-persistence";
import { TrackingService } from "../../../src/services/tracking/tracking-service";
import type { WalletRuntimeSnapshot } from "../../../src/services/wallet/domain/runtime";
import type {
  HeadlessSolanaRuntime,
  SolanaWalletDescriptor,
  SolanaWalletSnapshot,
} from "../../../src/services/wallet/solana-runtime";
import {
  type WalletRuntimeAdapters,
  WalletService,
} from "../../../src/services/wallet/wallet-service";
import { makeRuntimeTestController } from "./runtime-test-controller";

const account = "0x0000000000000000000000000000000000000501" as Address;

const makeAdapter = (name: string) => ({ name: name as WalletName }) as Adapter;

const descriptor = (
  adapter: Adapter,
  source: SolanaWalletDescriptor["source"]
): SolanaWalletDescriptor => ({
  adapter,
  readyState: WalletReadyState.Installed,
  source,
});

const makeConnectorFactory = (wallet: SolanaWalletDescriptor) =>
  createConnector((config) => ({
    $filteredChains: Stream.succeed([solana]),
    id: wallet.adapter.name,
    isSolanaConnector: true,
    name: wallet.adapter.name,
    rkDetails: {
      groupName: "Solana",
      installed: true,
    },
    solanaAdapter: wallet.adapter,
    solanaAdapterSource: wallet.source,
    type: `solana-${wallet.source}`,
    connect: async (parameters) =>
      ({
        accounts: parameters?.withCapabilities
          ? [{ address: account, capabilities: {} }]
          : [account],
        chainId: solana.id,
      }) as never,
    disconnect: async () => undefined,
    getAccounts: async () => [account],
    getChainId: async () => solana.id,
    getProvider: async () => ({}),
    isAuthorized: async () => false,
    onAccountsChanged: () => undefined,
    onChainChanged: () => undefined,
    onDisconnect: () => config.emitter.emit("disconnect"),
    sendTransaction: async () => "signature",
  }));

const makeSolanaRuntime = (initial: SolanaWalletSnapshot) => {
  const listeners = new Set<() => Promise<void> | void>();
  let snapshot = initial;
  const runtime = {
    connection: new Connection("https://api.mainnet-beta.solana.com"),
    getWalletSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies HeadlessSolanaRuntime;

  return {
    emit: async (next: SolanaWalletSnapshot) => {
      snapshot = next;
      await Promise.all([...listeners].map((listener) => listener()));
    },
    listenerCount: () => listeners.size,
    runtime,
  };
};

const waitForConnector = (wallet: WalletService["Service"], adapter: Adapter) =>
  wallet.changes.pipe(
    Stream.filter(
      (
        snapshot
      ): snapshot is Extract<WalletRuntimeSnapshot, { phase: "Ready" }> =>
        snapshot.phase === "Ready" &&
        snapshot.projection.connectors.some(
          (connector) =>
            "solanaAdapter" in connector && connector.solanaAdapter === adapter
        )
    ),
    Stream.runHead,
    Effect.map(Option.getOrThrow)
  );

describe("WalletService Solana runtime integration", () => {
  it("builds from the headless snapshot and publishes later membership through the same config", async () => {
    const fallbackAdapter = makeAdapter("Phantom");
    const standardAdapter = makeAdapter("Phantom");
    const fallback = descriptor(fallbackAdapter, "fallback");
    const standard = descriptor(standardAdapter, "standard");
    const solanaRuntime = makeSolanaRuntime({ wallets: [fallback] });
    const wagmiConfig = createConfig({
      chains: [solana],
      connectors: [makeConnectorFactory(fallback)],
      transports: { [solana.id]: http() },
    });
    const controller = makeRuntimeTestController({
      actions: {
        connect: () => Effect.void,
        disconnect: () => Effect.void,
      },
      createSolanaConnector: async (wallet: SolanaWalletDescriptor) =>
        makeConnectorFactory(wallet),
      enabledNetworks: new Set(["solana"]),
      miscConfig: {
        miscChainsMap: {
          solana: { skChainName: "solana", wagmiChain: solana },
        },
      },
      queryParamsInitChainId: undefined,
      solanaConnectorMode: true,
      wagmiConfig,
    });
    const buildOptions: Array<
      Parameters<WalletRuntimeAdapters["wagmi"]["buildConfig"]>[0]
    > = [];
    const adapters = {
      environment: {
        getEnabledNetworks: () => Effect.succeed(new Set(["solana"])),
        getHref: () => "https://widget.test/",
        getInitialYield: () => Effect.die("unused"),
        isLedgerDappBrowser: () => false,
        isMobileWallet: () => false,
      },
      solana: {
        makeRuntime: () => Effect.succeed(solanaRuntime.runtime),
      },
      wagmi: {
        buildConfig: (options) =>
          Effect.sync(() => {
            buildOptions.push(options);
            return controller;
          }),
        getConnection,
        getConnectors,
        initialize: () => Effect.void,
        watchConnection: (config, onChange) =>
          watchConnection(config, { onChange }),
        watchConnectors: (config, onChange) =>
          watchConnectors(config, { onChange }),
      },
    } satisfies WalletRuntimeAdapters;
    const settings = normalizeWidgetConfig({
      apiKey: "api-key",
      disableInjectedProviderDiscovery: true,
      variant: "default",
    });
    const configLayer = WidgetConfigService.layer({
      changes: Stream.never,
      current: Effect.succeed(settings),
      initial: settings,
    });
    const layer = WalletService.layerWithRuntimeAdapters(adapters).pipe(
      Layer.provide(
        Layer.mergeAll(
          configLayer,
          TrackingService.layer.pipe(Layer.provide(configLayer)),
          WidgetPersistence.layer
        )
      )
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const initial = yield* waitForConnector(wallet, fallbackAdapter);
          const changed = yield* waitForConnector(wallet, standardAdapter).pipe(
            Effect.forkChild({ startImmediately: true })
          );
          yield* Effect.promise(() =>
            solanaRuntime.emit({ wallets: [standard] })
          );
          return { changed: yield* Fiber.join(changed), initial };
        })
      ).pipe(Effect.provide(layer))
    );

    expect(buildOptions).toHaveLength(1);
    expect(buildOptions[0]?.solanaConnection).toBe(
      solanaRuntime.runtime.connection
    );
    expect(buildOptions[0]?.solanaWallets).toEqual([fallback]);
    expect(result.initial.wagmiConfig).toBe(wagmiConfig);
    expect(result.changed.wagmiConfig).toBe(wagmiConfig);
    expect(solanaRuntime.listenerCount()).toBe(0);
  });
});
