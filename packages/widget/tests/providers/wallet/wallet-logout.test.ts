import { describe, expect, it, vi } from "@effect/vitest";
import { Deferred, Effect, Fiber, Layer, Stream } from "effect";
import type { Connector } from "wagmi";
import { mainnet } from "wagmi/chains";
import type { WalletNetwork } from "../../../src/domain/wallet/network";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import { WidgetPersistence } from "../../../src/services/persistence/widget-persistence";
import { TrackingService } from "../../../src/services/tracking/tracking-service";
import { makeDefaultConfig } from "../../../src/services/wallet/default-wagmi-config";
import { SolanaPlatform } from "../../../src/services/wallet/internal/platform/solana-platform";
import { WagmiPlatform } from "../../../src/services/wallet/internal/platform/wagmi-platform";
import { WalletEnvironment } from "../../../src/services/wallet/internal/platform/wallet-environment";
import {
  WalletStorageCleanup,
  WalletStorageCleanupError,
} from "../../../src/services/wallet/internal/runtime/wallet-storage-cleanup";
import { WalletBootstrapSource } from "../../../src/services/wallet/wallet-bootstrap-source";
import { WalletConnectorSource } from "../../../src/services/wallet/wallet-connector-source";
import { WalletConnectionError } from "../../../src/services/wallet/wallet-errors";
import { WalletModal } from "../../../src/services/wallet/wallet-modal";
import { WalletService } from "../../../src/services/wallet/wallet-service";
import type { WalletCoreState } from "../../../src/services/wallet/wallet-state";
import { makeWalletTestController } from "./wallet-test-controller";

const connector = {
  id: "test",
  name: "Test",
  type: "injected",
  uid: "test-uid",
} as Connector;

const connection: WalletCoreState["connection"] = {
  address: "0x0000000000000000000000000000000000000001",
  addresses: ["0x0000000000000000000000000000000000000001"],
  chain: mainnet,
  chainId: mainnet.id,
  connector,
  isConnected: true,
  isConnecting: false,
  isDisconnected: false,
  isReconnecting: false,
  status: "connected",
};

const makeLogoutLayer = ({
  cleanup,
  close,
  disconnect,
}: {
  readonly cleanup: Effect.Effect<void, WalletStorageCleanupError>;
  readonly close: Effect.Effect<void>;
  readonly disconnect: Effect.Effect<void, WalletConnectionError>;
}) => {
  const settings = {
    apiKey: "api-key",
    disableInjectedProviderDiscovery: true,
    variant: "default" as const,
  };
  const configLayer = WidgetConfigService.layer(settings);
  const wagmiConfig = makeDefaultConfig();
  const controller = makeWalletTestController({
    actions: { disconnect: () => disconnect },
    evmConfig: {
      evmChains: [mainnet],
      evmChainsMap: {
        ethereum: { network: "ethereum", wagmiChain: mainnet },
      },
    },
    queryParamsInitChainId: undefined,
    wagmiConfig,
  });
  const modal = WalletModal.of({
    closeChain: close,
    install: () => Effect.void,
    openConnect: Effect.void,
    uninstall: () => Effect.void,
  });

  return WalletService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        configLayer,
        WalletConnectorSource.defaultLayer,
        Layer.succeed(WalletBootstrapSource, {
          getEnabledWalletNetworks: Effect.succeed(
            new Set<WalletNetwork>(["ethereum"])
          ),
          getOpportunity: () => Effect.die("unused"),
        }),
        Layer.succeed(WalletEnvironment, {
          href: Effect.succeed("https://widget.test/?network=ethereum"),
          isMobileWallet: Effect.succeed(false),
        }),
        Layer.succeed(SolanaPlatform, {
          makeRuntime: () =>
            Effect.succeed({
              connection: {} as never,
              current: Effect.succeed({ wallets: [] }),
              states: Stream.never,
            }),
        }),
        Layer.succeed(WagmiPlatform, {
          buildConfig: () => Effect.succeed(controller),
          initialize: () => Effect.void,
          observeCore: () =>
            Effect.succeed({
              current: Effect.succeed({ connection, connectors: [connector] }),
              states: Stream.never,
            }),
        }),
        TrackingService.layer.pipe(Layer.provide(configLayer)),
        Layer.succeed(WalletModal, modal),
        Layer.succeed(WalletStorageCleanup, {
          clearOwnedStorage: cleanup,
        }),
        WidgetPersistence.layer
      )
    )
  );
};

const runLogout = (layer: ReturnType<typeof makeLogoutLayer>) =>
  Effect.scoped(
    WalletService.use((wallet) => wallet.logout).pipe(Effect.provide(layer))
  );

describe("WalletService logout", () => {
  it.effect("disconnects, awaits owned cleanup, then closes the modal", () =>
    Effect.gen(function* () {
      const events: string[] = [];
      yield* runLogout(
        makeLogoutLayer({
          cleanup: Effect.sync(() => events.push("cleanup")).pipe(
            Effect.asVoid
          ),
          close: Effect.sync(() => events.push("close")).pipe(Effect.asVoid),
          disconnect: Effect.sync(() => events.push("disconnect")).pipe(
            Effect.asVoid
          ),
        })
      );

      expect(events).toEqual(["disconnect", "cleanup", "close"]);
    })
  );

  it.effect("does not clean or close when disconnect fails", () =>
    Effect.gen(function* () {
      const cleanup = vi.fn();
      const close = vi.fn();
      expect(
        yield* Effect.flip(
          runLogout(
            makeLogoutLayer({
              cleanup: Effect.sync(cleanup),
              close: Effect.sync(close),
              disconnect: Effect.fail(
                new WalletConnectionError({
                  cause: new Error("rejected"),
                  operation: "disconnect",
                })
              ),
            })
          )
        )
      ).toMatchObject({ _tag: "WalletConnectionError" });

      expect(cleanup).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
    })
  );

  it.effect("shares concurrent calls and permits a later retry", () =>
    Effect.gen(function* () {
      const started = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const disconnect = vi.fn(() =>
        Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Deferred.await(release))
        )
      );
      const close = vi.fn();
      const cleanupError = new WalletStorageCleanupError({
        cause: new Error("blocked"),
      });
      const layer = makeLogoutLayer({
        cleanup: Effect.fail(cleanupError),
        close: Effect.sync(close),
        disconnect: Effect.suspend(disconnect),
      });

      const failures = yield* Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const first = yield* wallet.logout.pipe(
            Effect.flip,
            Effect.forkChild
          );
          yield* Deferred.await(started);
          const second = yield* wallet.logout.pipe(
            Effect.flip,
            Effect.forkChild({ startImmediately: true })
          );
          yield* Deferred.succeed(release, undefined);
          const concurrent = yield* Effect.all([
            Fiber.join(first),
            Fiber.join(second),
          ]);
          const retry = yield* wallet.logout.pipe(Effect.flip);
          return [...concurrent, retry];
        }).pipe(Effect.provide(layer))
      );

      expect(disconnect).toHaveBeenCalledTimes(2);
      expect(close).toHaveBeenCalledTimes(2);
      expect(failures).toEqual([cleanupError, cleanupError, cleanupError]);
    })
  );
});
