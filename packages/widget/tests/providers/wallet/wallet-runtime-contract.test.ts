import { Deferred, Effect, Fiber, Layer, Option, Stream } from "effect";
import { describe, expect, it } from "vitest";
import type { Config, Connector } from "wagmi";
import {
  getConnection,
  getConnectors,
  watchConnection,
  watchConnectors,
} from "wagmi/actions";
import { normalizeWidgetConfig } from "../../../src/app/config";
import type { SKExternalProviders } from "../../../src/public-api/types";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import { WidgetPersistence } from "../../../src/services/persistence/widget-persistence";
import { makeDefaultConfig } from "../../../src/services/wallet/default-wagmi-config";
import type { WalletController } from "../../../src/services/wallet/wagmi-config";
import {
  type WalletRuntimeAdapters,
  WalletService,
} from "../../../src/services/wallet/wallet-service";

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

const readySnapshot = (wallet: WalletService["Service"]) =>
  wallet.changes.pipe(
    Stream.filter((snapshot) => snapshot.phase === "Ready"),
    Stream.runHead,
    Effect.map(Option.getOrThrow)
  );

const failedSnapshot = (wallet: WalletService["Service"]) =>
  wallet.changes.pipe(
    Stream.filter((snapshot) => snapshot.phase === "BootstrapFailed"),
    Stream.runHead,
    Effect.map(Option.getOrThrow)
  );

describe("WalletService Wallet Runtime", () => {
  it("is observable while bootstrapping and publishes the ready runtime", async () => {
    const buildRelease = await Effect.runPromise(Deferred.make<void>());
    const wagmiConfig = makeDefaultConfig();
    const controller = {
      actions: {},
      queryParamsInitChainId: undefined,
      wagmiConfig,
    } as unknown as WalletController;
    const adapters = {
      environment: {
        getEnabledNetworks: () => Effect.succeed(new Set(["ethereum"])),
        getHref: () => "https://widget.test/?network=ethereum",
        getInitialYield: () => Effect.die("unused"),
        isLedgerDappBrowser: () => false,
        isMobileWallet: () => false,
      },
      wagmi: {
        buildConfig: () =>
          Deferred.await(buildRelease).pipe(Effect.as(controller)),
        getConnection,
        getConnectors,
        initialize: () => Effect.void,
        watchConnection: (config, onChange) =>
          watchConnection(config, { onChange }),
        watchConnectors: (config, onChange) =>
          watchConnectors(config, { onChange }),
      },
    } satisfies WalletRuntimeAdapters;
    const layer = WalletService.layerWithRuntimeAdapters(adapters).pipe(
      Layer.provide(Layer.mergeAll(configLayer, WidgetPersistence.layer))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const initial = yield* wallet.current;
          const bootstrapping = yield* wallet.changes.pipe(Stream.runHead);
          const readyFiber = yield* readySnapshot(wallet).pipe(
            Effect.forkChild({ startImmediately: true })
          );

          yield* Deferred.succeed(buildRelease, undefined);
          const ready = yield* Fiber.join(readyFiber);

          return { bootstrapping, initial, ready };
        })
      ).pipe(Effect.provide(layer))
    );

    expect(result.initial).toEqual({
      cause: null,
      phase: "Bootstrapping",
      projection: null,
      wagmiConfig: null,
    });
    expect(Option.getOrThrow(result.bootstrapping)).toEqual(result.initial);
    expect(result.ready).toMatchObject({
      cause: null,
      phase: "Ready",
      wagmiConfig,
    });
    expect(result.ready.projection).not.toBeNull();
  });

  it("captures bootstrap inputs once and keeps one config identity", async () => {
    const externalProviders = {
      currentAddress: "0x0000000000000000000000000000000000000001",
      currentChain: 1,
      provider: {
        sendTransaction: async () => "transaction-hash",
        signMessage: async () => "signature",
        switchChain: async () => undefined,
      },
      supportedChainIds: [1],
      type: "generic",
    } satisfies SKExternalProviders;
    let currentSettings = normalizeWidgetConfig({
      apiKey: "api-key",
      disableInjectedProviderDiscovery: true,
      externalProviders,
      variant: "default",
    });
    let isLedgerDappBrowser = false;
    let isMobileWallet = true;
    let buildCount = 0;
    const buildStarted = await Effect.runPromise(Deferred.make<void>());
    const buildRelease = await Effect.runPromise(Deferred.make<void>());
    const capturedOptions: Array<
      Parameters<WalletRuntimeAdapters["wagmi"]["buildConfig"]>[0]
    > = [];
    const initializationInputs: Array<
      Parameters<WalletRuntimeAdapters["wagmi"]["initialize"]>[0]
    > = [];
    const wagmiConfig = makeDefaultConfig();
    const controller = {
      actions: {},
      queryParamsInitChainId: undefined,
      wagmiConfig,
    } as unknown as WalletController;
    const adapters = {
      environment: {
        getEnabledNetworks: () => Effect.succeed(new Set(["ethereum"])),
        getHref: () => "https://widget.test/?network=ethereum",
        getInitialYield: () => Effect.die("unused"),
        isLedgerDappBrowser: () => isLedgerDappBrowser,
        isMobileWallet: () => isMobileWallet,
      },
      wagmi: {
        buildConfig: (options) =>
          Effect.gen(function* () {
            buildCount += 1;
            capturedOptions.push(options);
            yield* Deferred.succeed(buildStarted, undefined);
            yield* Deferred.await(buildRelease);
            return controller;
          }),
        getConnection,
        getConnectors,
        initialize: (input) =>
          Effect.sync(() => {
            initializationInputs.push(input);
          }),
        watchConnection: (config, onChange) =>
          watchConnection(config, { onChange }),
        watchConnectors: (config, onChange) =>
          watchConnectors(config, { onChange }),
      },
    } satisfies WalletRuntimeAdapters;
    const mutableConfigLayer = WidgetConfigService.layer({
      changes: Stream.never,
      current: Effect.sync(() => currentSettings),
      initial: currentSettings,
    });
    const layer = WalletService.layerWithRuntimeAdapters(adapters).pipe(
      Layer.provide(Layer.mergeAll(mutableConfigLayer, WidgetPersistence.layer))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const readyFiber = yield* readySnapshot(wallet).pipe(
            Effect.forkChild({ startImmediately: true })
          );
          yield* Deferred.await(buildStarted);
          currentSettings = normalizeWidgetConfig({
            apiKey: "changed-api-key",
            variant: "default",
            wagmi: { forceWalletConnectOnly: true },
          });
          isLedgerDappBrowser = true;
          isMobileWallet = false;
          yield* Deferred.succeed(buildRelease, undefined);
          const first = yield* Fiber.join(readyFiber);
          yield* Effect.yieldNow;
          const second = yield* wallet.current;
          const authoritativeConfig = yield* wallet.config;

          return { authoritativeConfig, first, second };
        })
      ).pipe(Effect.provide(layer))
    );

    expect(buildCount).toBe(1);
    expect(capturedOptions).toHaveLength(1);
    expect(capturedOptions[0]).toMatchObject({
      disableInjectedProviderDiscovery: true,
      forceWalletConnectOnly: false,
      hasExternalProvider: true,
      queryParams: { network: "ethereum" },
    });
    expect(capturedOptions[0]?.externalProviders?.current).not.toBe(
      externalProviders
    );
    expect(capturedOptions[0]?.externalProviders?.current).toEqual(
      externalProviders
    );
    expect(initializationInputs).toEqual([
      expect.objectContaining({
        hasExternalProvider: true,
        isLedgerDappBrowser: false,
        isMobileWallet: true,
        wagmiConfig,
      }),
    ]);
    expect(result.second).toBe(result.first);
    expect(result.authoritativeConfig).toBe(wagmiConfig);
    expect(result.second.wagmiConfig).toBe(wagmiConfig);
  });

  it("installs watchers before seeding and releases them with the scope", async () => {
    const order: string[] = [];
    let connectionDisposals = 0;
    let connectorDisposals = 0;
    let emitConnectors:
      | ((connectors: ReadonlyArray<Connector>) => void)
      | undefined;
    const wagmiConfig = makeDefaultConfig();
    const seededConnection = getConnection(wagmiConfig);
    const pendingConnection = {
      ...seededConnection,
    } as typeof seededConnection;
    const seededConnectors: ReadonlyArray<Connector> = [];
    const pendingConnectors = [
      { id: "pending" } as unknown as Connector,
    ] as const;
    const controller = {
      actions: {},
      queryParamsInitChainId: undefined,
      wagmiConfig,
    } as unknown as WalletController;
    const adapters = {
      environment: {
        getEnabledNetworks: () => Effect.succeed(new Set(["ethereum"])),
        getHref: () => "https://widget.test/",
        getInitialYield: () => Effect.die("unused"),
        isLedgerDappBrowser: () => false,
        isMobileWallet: () => false,
      },
      wagmi: {
        buildConfig: () => Effect.succeed(controller),
        getConnection: (_config: Config) => {
          order.push("seed-connection");
          return seededConnection;
        },
        getConnectors: (_config: Config) => {
          order.push("seed-connectors");
          return seededConnectors;
        },
        initialize: () =>
          Effect.sync(() => {
            order.push("initialize");
          }),
        watchConnection: (_config: Config, onChange) => {
          order.push("watch-connection");
          onChange(pendingConnection);
          return () => {
            connectionDisposals += 1;
          };
        },
        watchConnectors: (_config: Config, onChange) => {
          order.push("watch-connectors");
          emitConnectors = onChange;
          onChange(pendingConnectors);
          return () => {
            connectorDisposals += 1;
          };
        },
      },
    } satisfies WalletRuntimeAdapters;
    const layer = WalletService.layerWithRuntimeAdapters(adapters).pipe(
      Layer.provide(Layer.mergeAll(configLayer, WidgetPersistence.layer))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const ready = yield* readySnapshot(wallet);
          const changedConnectors = [
            ...pendingConnectors,
            { id: "changed" } as unknown as Connector,
          ];
          const changedFiber = yield* wallet.changes.pipe(
            Stream.filter(
              (snapshot) =>
                snapshot.phase === "Ready" &&
                snapshot.projection.connectors === changedConnectors
            ),
            Stream.runHead,
            Effect.map(Option.getOrThrow),
            Effect.forkChild({ startImmediately: true })
          );
          yield* Effect.yieldNow;
          emitConnectors?.(changedConnectors);
          const changed = yield* Fiber.join(changedFiber);
          return { changed, ready };
        })
      ).pipe(Effect.provide(layer))
    );

    expect(order.slice(0, 4)).toEqual([
      "watch-connection",
      "watch-connectors",
      "seed-connection",
      "seed-connectors",
    ]);
    expect(order.at(-1)).toBe("initialize");
    expect(result.ready.projection.connection).toBe(pendingConnection);
    expect(result.ready.projection.connectors).toBe(pendingConnectors);
    expect(result.changed.phase).toBe("Ready");
    if (result.changed.phase !== "Ready") {
      throw new Error("expected a ready wallet projection");
    }
    expect(result.changed.projection.connectors).not.toBe(
      result.ready.projection.connectors
    );
    expect(connectionDisposals).toBe(1);
    expect(connectorDisposals).toBe(1);
  });

  it("publishes a terminal failure without exposing partial readiness", async () => {
    const cause = new Error("configuration failed");
    let watches = 0;
    let initializations = 0;
    const adapters = {
      environment: {
        getEnabledNetworks: () => Effect.succeed(new Set(["ethereum"])),
        getHref: () => "https://widget.test/",
        getInitialYield: () => Effect.die("unused"),
        isLedgerDappBrowser: () => false,
        isMobileWallet: () => false,
      },
      wagmi: {
        buildConfig: () => Effect.fail(cause),
        getConnection:
          getConnection as WalletRuntimeAdapters["wagmi"]["getConnection"],
        getConnectors:
          getConnectors as WalletRuntimeAdapters["wagmi"]["getConnectors"],
        initialize: () => {
          initializations += 1;
          return Effect.void;
        },
        watchConnection: () => {
          watches += 1;
          return () => undefined;
        },
        watchConnectors: () => {
          watches += 1;
          return () => undefined;
        },
      },
    } satisfies WalletRuntimeAdapters;
    const layer = WalletService.layerWithRuntimeAdapters(adapters).pipe(
      Layer.provide(Layer.mergeAll(configLayer, WidgetPersistence.layer))
    );

    const failed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const snapshot = yield* failedSnapshot(wallet);
          const current = yield* wallet.current;
          const authoritativeConfig = yield* wallet.config;
          expect(current).toBe(snapshot);
          expect(authoritativeConfig).toBeNull();
          return snapshot;
        })
      ).pipe(Effect.provide(layer))
    );

    expect(failed).toMatchObject({
      cause,
      phase: "BootstrapFailed",
      projection: null,
      wagmiConfig: null,
    });
    expect(watches).toBe(0);
    expect(initializations).toBe(0);
  });

  it("releases installed watchers when a seed read fails", async () => {
    const cause = new Error("connector seed failed");
    let disposals = 0;
    const wagmiConfig = makeDefaultConfig();
    const controller = {
      actions: {},
      queryParamsInitChainId: undefined,
      wagmiConfig,
    } as unknown as WalletController;
    const adapters = {
      environment: {
        getEnabledNetworks: () => Effect.succeed(new Set(["ethereum"])),
        getHref: () => "https://widget.test/",
        getInitialYield: () => Effect.die("unused"),
        isLedgerDappBrowser: () => false,
        isMobileWallet: () => false,
      },
      wagmi: {
        buildConfig: () => Effect.succeed(controller),
        getConnection,
        getConnectors: () => {
          throw cause;
        },
        initialize: () => Effect.void,
        watchConnection: () => () => {
          disposals += 1;
        },
        watchConnectors: () => () => {
          disposals += 1;
        },
      },
    } satisfies WalletRuntimeAdapters;
    const layer = WalletService.layerWithRuntimeAdapters(adapters).pipe(
      Layer.provide(Layer.mergeAll(configLayer, WidgetPersistence.layer))
    );

    const failed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          return yield* failedSnapshot(wallet);
        })
      ).pipe(Effect.provide(layer))
    );

    expect(failed).toMatchObject({ cause, phase: "BootstrapFailed" });
    expect(disposals).toBe(2);
  });

  it("keeps background initialization failures recoverable after readiness", async () => {
    const initializationStarted = await Effect.runPromise(
      Deferred.make<void>()
    );
    const initializationRelease = await Effect.runPromise(
      Deferred.make<void>()
    );
    const wagmiConfig = makeDefaultConfig();
    const controller = {
      actions: {},
      queryParamsInitChainId: undefined,
      wagmiConfig,
    } as unknown as WalletController;
    const adapters = {
      environment: {
        getEnabledNetworks: () => Effect.succeed(new Set(["ethereum"])),
        getHref: () => "https://widget.test/",
        getInitialYield: () => Effect.die("unused"),
        isLedgerDappBrowser: () => false,
        isMobileWallet: () => false,
      },
      wagmi: {
        buildConfig: () => Effect.succeed(controller),
        getConnection,
        getConnectors,
        initialize: () =>
          Effect.gen(function* () {
            yield* Deferred.succeed(initializationStarted, undefined);
            yield* Deferred.await(initializationRelease);
            return yield* Effect.fail(new Error("reconnect failed"));
          }),
        watchConnection: (config, onChange) =>
          watchConnection(config, { onChange }),
        watchConnectors: (config, onChange) =>
          watchConnectors(config, { onChange }),
      },
    } satisfies WalletRuntimeAdapters;
    const layer = WalletService.layerWithRuntimeAdapters(adapters).pipe(
      Layer.provide(Layer.mergeAll(configLayer, WidgetPersistence.layer))
    );

    const snapshots = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const ready = yield* readySnapshot(wallet);
          yield* Deferred.await(initializationStarted);
          const whileInitializing = yield* wallet.current;
          yield* Deferred.succeed(initializationRelease, undefined);
          yield* Effect.yieldNow;
          const afterFailure = yield* wallet.current;
          return { afterFailure, ready, whileInitializing };
        })
      ).pipe(Effect.provide(layer))
    );

    expect(snapshots.whileInitializing).toBe(snapshots.ready);
    expect(snapshots.afterFailure).toBe(snapshots.ready);
    expect(snapshots.afterFailure.phase).toBe("Ready");
  });

  it("constructs a fresh service and config after scoped remount", async () => {
    let builds = 0;
    let disposals = 0;
    const adapters = {
      environment: {
        getEnabledNetworks: () => Effect.succeed(new Set(["ethereum"])),
        getHref: () => "https://widget.test/",
        getInitialYield: () => Effect.die("unused"),
        isLedgerDappBrowser: () => false,
        isMobileWallet: () => false,
      },
      wagmi: {
        buildConfig: () =>
          Effect.sync(() => {
            builds += 1;
            return {
              actions: {},
              queryParamsInitChainId: undefined,
              wagmiConfig: makeDefaultConfig(),
            } as unknown as WalletController;
          }),
        getConnection,
        getConnectors,
        initialize: () => Effect.void,
        watchConnection: (config, onChange) => {
          const unsubscribe = watchConnection(config, { onChange });
          return () => {
            disposals += 1;
            unsubscribe();
          };
        },
        watchConnectors: (config, onChange) => {
          const unsubscribe = watchConnectors(config, { onChange });
          return () => {
            disposals += 1;
            unsubscribe();
          };
        },
      },
    } satisfies WalletRuntimeAdapters;
    const layer = WalletService.layerWithRuntimeAdapters(adapters).pipe(
      Layer.provide(Layer.mergeAll(configLayer, WidgetPersistence.layer))
    );
    const mount = () =>
      Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const wallet = yield* WalletService;
            const ready = yield* readySnapshot(wallet);
            return { config: ready.wagmiConfig, wallet };
          })
        ).pipe(Effect.provide(layer))
      );

    const first = await mount();
    const second = await mount();

    expect(builds).toBe(2);
    expect(disposals).toBe(4);
    expect(second.wallet).not.toBe(first.wallet);
    expect(second.config).not.toBe(first.config);
  });
});
