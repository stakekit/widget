import { Deferred, Effect, Fiber, Layer, Option, Stream } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";
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
import { WalletBootstrapSource } from "../../../src/services/wallet/wallet-bootstrap-source";
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
    getEnabledWalletNetworks: () => Effect.succeed(new Set(["ethereum"])),
    getOpportunity: () => Effect.die("unused"),
  })
);

const makeConfigLayer = () => WidgetConfigService.layer(settings);

const makeWalletLayer = (
  wagmi: WagmiPlatformService,
  configLayer = makeConfigLayer(),
  walletApiLayer = apiLayer
) => {
  const trackingLayer = TrackingService.layer.pipe(Layer.provide(configLayer));
  const walletLayer = WalletService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        walletApiLayer,
        configLayer,
        environmentLayer,
        solanaLayer,
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
  it("blocks until bootstrap and initial connection finish", async () => {
    const buildStarted = await Effect.runPromise(Deferred.make<void>());
    const buildRelease = await Effect.runPromise(Deferred.make<void>());
    const initializeStarted = await Effect.runPromise(Deferred.make<void>());
    const initializeRelease = await Effect.runPromise(Deferred.make<void>());
    const acquired = await Effect.runPromise(
      Deferred.make<WalletService["Service"]>()
    );
    const releaseScope = await Effect.runPromise(Deferred.make<void>());
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

    const fiber = Effect.runFork(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          yield* Deferred.succeed(acquired, wallet);
          yield* Deferred.await(releaseScope);
        }).pipe(Effect.provide(layer))
      )
    );

    await Effect.runPromise(Deferred.await(buildStarted));
    expect(
      Option.isNone(await Effect.runPromise(Deferred.poll(acquired)))
    ).toBe(true);
    await Effect.runPromise(Deferred.succeed(buildRelease, undefined));
    await Effect.runPromise(Deferred.await(initializeStarted));
    expect(
      Option.isNone(await Effect.runPromise(Deferred.poll(acquired)))
    ).toBe(true);
    await Effect.runPromise(Deferred.succeed(initializeRelease, undefined));

    const wallet = await Effect.runPromise(Deferred.await(acquired));
    const state = await Effect.runPromise(wallet.state);
    expect(wallet.wagmiConfig).toBe(wagmiConfig);
    expect(state.connection.status).toBe("disconnected");
    expect(state.ledger).toEqual({
      accounts: [],
      currentAccountId: undefined,
      disabledChains: [],
    });

    await Effect.runPromise(Deferred.succeed(releaseScope, undefined));
    await Effect.runPromise(Fiber.join(fiber));
  });

  it("uses capability Layers and keeps one bootstrap config identity", async () => {
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

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          expect(wallet.wagmiConfig).toBe(wagmiConfig);
          expect((yield* wallet.state).connection.status).toBe("disconnected");
        }).pipe(Effect.provide(layer))
      )
    );

    expect(builds).toHaveLength(1);
    expect(builds[0]).toMatchObject({
      disableInjectedProviderDiscovery: true,
      enabledNetworks: new Set(["ethereum"]),
      queryParams: { network: "ethereum" },
    });
    expect(initializations).toEqual([expect.objectContaining({ wagmiConfig })]);
  });

  it("fails acquisition with the bootstrap stage and never exposes a service", async () => {
    const cause = new Error("configuration failed");
    const layer = makeWalletLayer({
      buildConfig: () => Effect.fail({ cause } as never),
      initialize: () => Effect.void,
      observeCore: () => Effect.die("must not observe"),
    });

    const failure = await Effect.runPromise(
      Effect.scoped(WalletService.pipe(Effect.provide(layer), Effect.flip))
    );

    expect(failure).toBeInstanceOf(WalletBootstrapError);
    expect(failure).toMatchObject({ stage: "wagmi-config" });
    expect((failure as WalletBootstrapError).cause).toEqual({ cause });
  });

  it("fails acquisition after bounded enabled-network retries", async () => {
    const cause = new Error("enabled networks unavailable");
    const failingApiLayer = Layer.succeed(
      WalletBootstrapSource,
      WalletBootstrapSource.of({
        getEnabledWalletNetworks: () => Effect.fail(cause),
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

    const failure = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.scoped(
          WalletService.pipe(Effect.provide(layer), Effect.flip)
        ).pipe(Effect.forkChild({ startImmediately: true }));
        yield* Effect.yieldNow;
        yield* TestClock.adjust("4 seconds");
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestClock.layer()))
    );

    expect(failure).toMatchObject({
      _tag: "WalletBootstrapError",
      cause,
      stage: "enabled-networks",
    });
  });

  it("keeps state and commands available when wallet topology changes", async () => {
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

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const config = yield* WidgetConfigService;
          yield* config.update({
            apiKey: "api-key",
            variant: "default",
            wagmi: { forceWalletConnectOnly: true },
          });
          yield* Effect.yieldNow;
          const state = yield* wallet.state;
          return { config: wallet.wagmiConfig, state };
        }).pipe(Effect.provide(layer))
      )
    );

    expect(result.config).toBe(wagmiConfig);
    expect(result.state).toBeDefined();
  });

  it("constructs fresh scoped services after remount", async () => {
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
      Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const wallet = yield* WalletService;
            return { config: wallet.wagmiConfig, wallet };
          }).pipe(Effect.provide(layer))
        )
      );

    const first = await mount();
    const second = await mount();

    expect(builds).toBe(2);
    expect(initializations).toBe(2);
    expect(second.wallet).not.toBe(first.wallet);
    expect(second.config).not.toBe(first.config);
  });
});
