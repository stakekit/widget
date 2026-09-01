import { describe, expect, it, vi } from "@effect/vitest";
import { Deferred, Effect, Fiber, Layer, Option, Stream } from "effect";
import { TestClock } from "effect/testing";
import type { Config } from "wagmi";
import { getConnection, getConnectors } from "wagmi/actions";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import { WidgetPersistence } from "../../../src/services/persistence/widget-persistence";
import { TrackingService } from "../../../src/services/tracking/tracking-service";
import { makeDefaultConfig } from "../../../src/services/wallet/default-wagmi-config";
import {
  SolanaPlatform,
  type SolanaRuntime,
} from "../../../src/services/wallet/internal/platform/solana-platform";
import {
  WagmiPlatform,
  type WagmiPlatformService,
} from "../../../src/services/wallet/internal/platform/wagmi-platform";
import { WalletEnvironment } from "../../../src/services/wallet/internal/platform/wallet-environment";
import { WalletBootstrapError } from "../../../src/services/wallet/internal/runtime/bootstrap";
import { WalletStorageCleanup } from "../../../src/services/wallet/internal/runtime/wallet-storage-cleanup";
import {
  WalletBootstrapSource,
  WalletBootstrapSourceReadError,
} from "../../../src/services/wallet/wallet-bootstrap-source";
import {
  WalletConnectorSource,
  type WalletListFactory,
} from "../../../src/services/wallet/wallet-connector-source";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import { WalletService } from "../../../src/services/wallet/wallet-service";
import { makeWalletTestController } from "./wallet-test-controller";

const settings = {
  apiKey: "api-key",
  disableInjectedProviderDiscovery: true,
  variant: "default" as const,
};

const environmentLayer = Layer.succeed(
  WalletEnvironment,
  WalletEnvironment.of({
    href: Effect.succeed("https://widget.test/?network=ethereum"),
    isMobileWallet: Effect.succeed(false),
  })
);

const solanaLayer = Layer.succeed(
  SolanaPlatform,
  SolanaPlatform.of({
    makeRuntime: () =>
      Effect.succeed({
        connection: {} as SolanaRuntime["connection"],
        current: Effect.succeed({ wallets: [] }),
        states: Stream.concat(Stream.succeed({ wallets: [] }), Stream.never),
      }),
  })
);

const apiLayer = Layer.succeed(
  WalletBootstrapSource,
  WalletBootstrapSource.of({
    getEnabledWalletNetworks: Effect.succeed(new Set(["ethereum"])),
    getOpportunity: () => Effect.die("unused"),
  })
);

const makeConfigLayer = () => WidgetConfigService.layer(settings);

const makeWalletLayer = (
  wagmi: WagmiPlatformService,
  configLayer = makeConfigLayer(),
  walletApiLayer = apiLayer,
  connectorSourceLayer = WalletConnectorSource.defaultLayer,
  walletSolanaLayer = solanaLayer
) => {
  const trackingLayer = TrackingService.layer.pipe(Layer.provide(configLayer));
  const walletLayer = WalletService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        walletApiLayer,
        configLayer,
        environmentLayer,
        walletSolanaLayer,
        connectorSourceLayer,
        Layer.succeed(WagmiPlatform, WagmiPlatform.of(wagmi)),
        trackingLayer,
        WalletModal.layer,
        WalletStorageCleanup.layer,
        WidgetPersistence.layer
      )
    )
  );
  return Layer.merge(configLayer, walletLayer);
};

const makeObservation = (wagmiConfig: Config) => {
  const core = {
    connection: getConnection(wagmiConfig),
    connectors: getConnectors(wagmiConfig),
  };
  return {
    current: Effect.succeed(core),
    states: Stream.concat(Stream.succeed(core), Stream.never),
  };
};

describe("WalletService acquisition", () => {
  it.effect("blocks until bootstrap and initial connection finish", () =>
    Effect.gen(function* () {
      const buildStarted = yield* Deferred.make<void>();
      const buildRelease = yield* Deferred.make<void>();
      const initializeStarted = yield* Deferred.make<void>();
      const initializeRelease = yield* Deferred.make<void>();
      const acquired = yield* Deferred.make<WalletService["Service"]>();
      const releaseScope = yield* Deferred.make<void>();
      const wagmiConfig = makeDefaultConfig();
      const controller = makeWalletTestController({
        actions: {},
        queryParamsInitChainId: undefined,
        wagmiConfig,
      });
      const layer = makeWalletLayer({
        buildConfig: () =>
          Effect.gen(function* () {
            yield* Deferred.succeed(buildStarted, undefined);
            yield* Deferred.await(buildRelease);
            return controller;
          }),
        initialize: () =>
          Effect.gen(function* () {
            yield* Deferred.succeed(initializeStarted, undefined);
            yield* Deferred.await(initializeRelease);
          }),
        observeCore: () => Effect.succeed(makeObservation(wagmiConfig)),
      });

      const fiber = yield* Effect.forkChild(
        Effect.scoped(
          Effect.gen(function* () {
            const wallet = yield* WalletService;
            yield* Deferred.succeed(acquired, wallet);
            yield* Deferred.await(releaseScope);
          }).pipe(Effect.provide(layer))
        )
      );

      yield* Deferred.await(buildStarted);
      expect(Option.isNone(yield* Deferred.poll(acquired))).toBe(true);
      yield* Deferred.succeed(buildRelease, undefined);
      yield* Deferred.await(initializeStarted);
      expect(Option.isNone(yield* Deferred.poll(acquired))).toBe(true);
      yield* Deferred.succeed(initializeRelease, undefined);

      const wallet = yield* Deferred.await(acquired);
      const state = yield* wallet.state;
      expect(wallet.wagmiConfig).toBe(wagmiConfig);
      expect(state.connection.status).toBe("disconnected");
      expect(state.ledger).toEqual({
        accounts: [],
        currentAccountId: undefined,
        disabledChains: [],
      });

      yield* Deferred.succeed(releaseScope, undefined);
      yield* Fiber.join(fiber);
    })
  );

  it.effect(
    "uses capability Layers and keeps one bootstrap config identity",
    () =>
      Effect.gen(function* () {
        const wagmiConfig = makeDefaultConfig();
        const controller = makeWalletTestController({
          actions: {},
          queryParamsInitChainId: undefined,
          wagmiConfig,
        });
        const builds: unknown[] = [];
        const initializations: unknown[] = [];
        const layer = makeWalletLayer({
          buildConfig: (input) =>
            Effect.sync(() => {
              builds.push(input);
              return controller;
            }),
          initialize: (input) =>
            Effect.sync(() => {
              initializations.push(input);
            }),
          observeCore: () => Effect.succeed(makeObservation(wagmiConfig)),
        });

        yield* Effect.scoped(
          Effect.gen(function* () {
            const wallet = yield* WalletService;
            expect(wallet.wagmiConfig).toBe(wagmiConfig);
            expect((yield* wallet.state).connection.status).toBe(
              "disconnected"
            );
          }).pipe(Effect.provide(layer))
        );

        expect(builds).toHaveLength(1);
        expect(builds[0]).toMatchObject({
          disableInjectedProviderDiscovery: true,
          enabledNetworks: new Set(["ethereum"]),
          queryParams: { network: "ethereum" },
        });
        expect(initializations).toEqual([
          expect.objectContaining({ wagmiConfig }),
        ]);
      })
  );

  it.effect("captures an injected Wallet List as fixed wallet topology", () =>
    Effect.gen(function* () {
      const walletListFactory: WalletListFactory = vi.fn(() => []);
      const buildInputs: Array<
        Parameters<WagmiPlatformService["buildConfig"]>[0]
      > = [];
      const solanaRuntimeInputs: Array<{
        readonly includeWalletAdapters: boolean;
      }> = [];
      const customApiLayer = Layer.succeed(
        WalletBootstrapSource,
        WalletBootstrapSource.of({
          getEnabledWalletNetworks: Effect.succeed(
            new Set(["ethereum", "solana"])
          ),
          getOpportunity: () => Effect.die("unused"),
        })
      );
      const customSolanaLayer = Layer.succeed(
        SolanaPlatform,
        SolanaPlatform.of({
          makeRuntime: (input) => {
            solanaRuntimeInputs.push(input);
            return Effect.succeed({
              connection: {} as SolanaRuntime["connection"],
              current: Effect.succeed({ wallets: [] }),
              states: Stream.concat(
                Stream.succeed({ wallets: [] }),
                Stream.never
              ),
            });
          },
        })
      );
      const wagmiConfig = makeDefaultConfig();
      const controller = makeWalletTestController({
        actions: {},
        queryParamsInitChainId: undefined,
        wagmiConfig,
      });
      const layer = makeWalletLayer(
        {
          buildConfig: (input) =>
            Effect.sync(() => {
              buildInputs.push(input);
              return controller;
            }),
          initialize: () => Effect.void,
          observeCore: () => Effect.succeed(makeObservation(wagmiConfig)),
        },
        makeConfigLayer(),
        customApiLayer,
        WalletConnectorSource.layer(walletListFactory),
        customSolanaLayer
      );

      yield* Effect.scoped(WalletService.pipe(Effect.provide(layer)));

      expect(solanaRuntimeInputs).toEqual([{ includeWalletAdapters: false }]);
      expect(buildInputs).toEqual([
        expect.objectContaining({ walletListFactory }),
      ]);
    })
  );

  it.effect(
    "fails acquisition with the bootstrap stage and never exposes a service",
    () =>
      Effect.gen(function* () {
        const cause = new Error("configuration failed");
        const layer = makeWalletLayer({
          buildConfig: () => Effect.fail({ cause } as never),
          initialize: () => Effect.void,
          observeCore: () => Effect.die("must not observe"),
        });

        const failure = yield* Effect.scoped(
          WalletService.pipe(Effect.provide(layer), Effect.flip)
        );

        expect(failure).toBeInstanceOf(WalletBootstrapError);
        expect(failure).toMatchObject({ stage: "wagmi-config" });
        expect((failure as WalletBootstrapError).cause).toEqual({ cause });
      })
  );

  it.effect("fails acquisition after bounded enabled-network retries", () =>
    Effect.gen(function* () {
      const cause = new Error("enabled networks unavailable");
      const failingApiLayer = Layer.succeed(
        WalletBootstrapSource,
        WalletBootstrapSource.of({
          getEnabledWalletNetworks: Effect.fail(
            new WalletBootstrapSourceReadError({ cause })
          ),
          getOpportunity: () => Effect.die("unused"),
        })
      );
      const layer = makeWalletLayer(
        {
          buildConfig: () => Effect.die("must not build"),
          initialize: () => Effect.void,
          observeCore: () => Effect.die("must not observe"),
        },
        makeConfigLayer(),
        failingApiLayer
      );

      const failure = yield* Effect.gen(function* () {
        const fiber = yield* Effect.scoped(
          WalletService.pipe(Effect.provide(layer), Effect.flip)
        ).pipe(Effect.forkChild({ startImmediately: true }));
        yield* Effect.yieldNow;
        yield* TestClock.adjust("4 seconds");
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestClock.layer()));

      expect(failure).toMatchObject({
        _tag: "WalletBootstrapError",
        stage: "enabled-networks",
      });
      expect((failure as WalletBootstrapError).cause).toEqual(
        new WalletBootstrapSourceReadError({ cause })
      );
    })
  );

  it.effect(
    "keeps state and commands available when wallet topology changes",
    () =>
      Effect.gen(function* () {
        const configLayer = makeConfigLayer();
        const wagmiConfig = makeDefaultConfig();
        const controller = makeWalletTestController({
          actions: {},
          queryParamsInitChainId: undefined,
          wagmiConfig,
        });
        const layer = makeWalletLayer(
          {
            buildConfig: () => Effect.succeed(controller),
            initialize: () => Effect.void,
            observeCore: () => Effect.succeed(makeObservation(wagmiConfig)),
          },
          configLayer
        );

        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const wallet = yield* WalletService;
            const config = yield* WidgetConfigService;
            yield* config.update({
              apiKey: "api-key",
              forceWalletConnectOnly: true,
              variant: "default",
            });
            yield* Effect.yieldNow;
            const state = yield* wallet.state;
            return { config: wallet.wagmiConfig, state };
          }).pipe(Effect.provide(layer))
        );

        expect(result.config).toBe(wagmiConfig);
        expect(result.state).toBeDefined();
      })
  );

  it.effect("constructs fresh scoped services after remount", () =>
    Effect.gen(function* () {
      let builds = 0;
      let initializations = 0;
      const layer = makeWalletLayer({
        buildConfig: () =>
          Effect.sync(() => {
            builds += 1;
            return makeWalletTestController({
              actions: {},
              queryParamsInitChainId: undefined,
              wagmiConfig: makeDefaultConfig(),
            });
          }),
        initialize: () =>
          Effect.sync(() => {
            initializations += 1;
          }),
        observeCore: (controller) =>
          Effect.succeed(makeObservation(controller.wagmiConfig)),
      });
      const mount = () =>
        Effect.scoped(
          Effect.gen(function* () {
            const wallet = yield* WalletService;
            return { config: wallet.wagmiConfig, wallet };
          }).pipe(Effect.provide(layer))
        );

      const first = yield* mount();
      const second = yield* mount();

      expect(builds).toBe(2);
      expect(initializations).toBe(2);
      expect(second.wallet).not.toBe(first.wallet);
      expect(second.config).not.toBe(first.config);
    })
  );
});
