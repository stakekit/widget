import { Deferred, Effect, Layer, Option, Ref, Stream } from "effect";
import type { Chain } from "viem";
import { mainnet, optimism } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { normalizeWidgetConfig } from "../../../src/app/config";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import { WidgetPersistence } from "../../../src/services/persistence/widget-persistence";
import { TrackingService } from "../../../src/services/tracking/tracking-service";
import { makeDefaultConfig } from "../../../src/services/wallet/default-wagmi-config";
import { WalletConnectionError } from "../../../src/services/wallet/domain/errors";
import type {
  WalletCoreProjection,
  WalletRuntimeSnapshot,
} from "../../../src/services/wallet/domain/runtime";
import type { NormalizedWalletState } from "../../../src/services/wallet/domain/state";
import {
  type WalletRuntimeAdapters,
  WalletService,
} from "../../../src/services/wallet/wallet-service";
import { makeRuntimeTestController } from "./runtime-test-controller";

const firstAddress = "0x0000000000000000000000000000000000000001" as const;
const secondAddress = "0x0000000000000000000000000000000000000002" as const;

const disconnectedConnection = {
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
} as const satisfies WalletCoreProjection["connection"];

const connectedConnection = ({
  address = firstAddress,
  chain = mainnet,
  connector,
}: {
  readonly address?: `0x${string}`;
  readonly chain?: Chain;
  readonly connector: Connector;
}): WalletCoreProjection["connection"] => ({
  address,
  addresses: [address],
  chain,
  chainId: chain.id,
  connector,
  isConnected: true,
  isConnecting: false,
  isDisconnected: false,
  isReconnecting: false,
  status: "connected",
});

const waitForCondition = Effect.fn("waitForCondition")(function* (
  condition: () => boolean
) {
  while (!condition()) yield* Effect.yieldNow;
});

const waitForState = (
  wallet: WalletService["Service"],
  predicate: (state: NormalizedWalletState) => boolean
) =>
  wallet.changes.pipe(
    Stream.filter(
      (
        snapshot
      ): snapshot is Extract<WalletRuntimeSnapshot, { phase: "Ready" }> =>
        snapshot.phase === "Ready" && predicate(snapshot.projection.state)
    ),
    Stream.runHead,
    Effect.map(Option.getOrThrow)
  );

const makeHarness = ({
  disconnect,
  initialConnection,
  trackEvent,
}: {
  readonly disconnect: (input: {
    readonly connector: Connector;
  }) => Effect.Effect<void, WalletConnectionError>;
  readonly initialConnection: (
    connector: Connector
  ) => WalletCoreProjection["connection"];
  readonly trackEvent: TrackingService["Service"]["trackEvent"];
}) => {
  const connector = {
    id: "test",
    name: "Test",
    type: "test",
    uid: "test-uid",
  } as unknown as Connector;
  let connection = initialConnection(connector);
  let publishConnection: (
    connection: WalletCoreProjection["connection"]
  ) => void = () => undefined;
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
  const controller = makeRuntimeTestController({
    actions: {
      connect: () => Effect.void,
      disconnect,
      reconnect: () => Effect.void,
      sendEvmTransaction: () => Effect.die("unused"),
      signMessage: () => Effect.die("unused"),
      switchChain: () => Effect.die("unused"),
    },
    evmConfig: {
      evmChains: [mainnet],
      evmChainsMap: {
        ethereum: { skChainName: "ethereum", wagmiChain: mainnet },
      },
    },
    queryParamsInitChainId: undefined,
    wagmiConfig: makeDefaultConfig(),
  });
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
      getConnection: () => connection,
      getConnectors: () => [connector],
      initialize: () => Effect.void,
      watchConnection: (_config, onChange) => {
        publishConnection = onChange;
        return () => undefined;
      },
      watchConnectors: () => () => undefined,
    },
  } satisfies WalletRuntimeAdapters;
  const trackingLayer = Layer.succeed(
    TrackingService,
    TrackingService.of({
      trackEvent,
      trackPageView: () => Effect.void,
    })
  );
  const layer = WalletService.layerWithRuntimeAdapters(adapters).pipe(
    Layer.provide(
      Layer.mergeAll(configLayer, WidgetPersistence.layer, trackingLayer)
    )
  );

  return {
    connector,
    emitConnection: (next: WalletCoreProjection["connection"]) => {
      connection = next;
      publishConnection(next);
    },
    layer,
  };
};

describe("WalletService lifecycle policies", () => {
  it("tracks each supported connection once and resets after leaving it", async () => {
    const trackEvent = vi.fn(() => Effect.void);
    const harness = makeHarness({
      disconnect: () => Effect.void,
      initialConnection: (connector) => connectedConnection({ connector }),
      trackEvent,
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          yield* waitForState(wallet, (state) => state.status === "connected");
          yield* waitForCondition(() => trackEvent.mock.calls.length === 1);

          harness.emitConnection(
            connectedConnection({ connector: harness.connector })
          );
          yield* Effect.yieldNow;
          expect(trackEvent).toHaveBeenCalledTimes(1);

          harness.emitConnection(disconnectedConnection);
          yield* waitForState(
            wallet,
            (state) => state.status === "disconnected"
          );
          harness.emitConnection(
            connectedConnection({ connector: harness.connector })
          );
          yield* waitForCondition(() => trackEvent.mock.calls.length === 2);

          harness.emitConnection(
            connectedConnection({
              address: secondAddress,
              connector: harness.connector,
            })
          );
          yield* waitForCondition(() => trackEvent.mock.calls.length === 3);
        })
      ).pipe(Effect.provide(harness.layer))
    );

    expect(trackEvent).toHaveBeenNthCalledWith(1, "connectedWallet", {
      address: firstAddress,
      network: "ethereum",
    });
    expect(trackEvent).toHaveBeenNthCalledWith(3, "connectedWallet", {
      address: secondAddress,
      network: "ethereum",
    });
  });

  it("disconnects each unsupported connection once and resets on safe states", async () => {
    const disconnect = vi.fn(() => Effect.void);
    const harness = makeHarness({
      disconnect,
      initialConnection: (connector) =>
        connectedConnection({ chain: optimism, connector }),
      trackEvent: () => Effect.void,
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          yield* waitForState(
            wallet,
            (state) => state.status === "unsupported"
          );
          yield* waitForCondition(() => disconnect.mock.calls.length === 1);

          harness.emitConnection(
            connectedConnection({
              chain: optimism,
              connector: harness.connector,
            })
          );
          yield* Effect.yieldNow;
          expect(disconnect).toHaveBeenCalledTimes(1);

          harness.emitConnection(
            connectedConnection({ connector: harness.connector })
          );
          yield* waitForState(wallet, (state) => state.status === "connected");
          harness.emitConnection(
            connectedConnection({
              chain: optimism,
              connector: harness.connector,
            })
          );
          yield* waitForCondition(() => disconnect.mock.calls.length === 2);

          harness.emitConnection(disconnectedConnection);
          yield* waitForState(
            wallet,
            (state) => state.status === "disconnected"
          );
          harness.emitConnection(
            connectedConnection({
              chain: optimism,
              connector: harness.connector,
            })
          );
          yield* waitForCondition(() => disconnect.mock.calls.length === 3);
        })
      ).pipe(Effect.provide(harness.layer))
    );

    expect(disconnect).toHaveBeenCalledWith({ connector: harness.connector });
  });

  it("recovers failed lifecycle effects without poisoning the runtime", async () => {
    let disconnectAttempts = 0;
    let trackingAttempts = 0;
    const disconnect = vi.fn(() => {
      disconnectAttempts += 1;
      return disconnectAttempts === 1
        ? Effect.fail(
            new WalletConnectionError({
              cause: new Error("disconnect failed"),
              operation: "disconnect",
            })
          )
        : Effect.void;
    });
    const trackEvent = vi.fn(() => {
      trackingAttempts += 1;
      return trackingAttempts === 1
        ? Effect.sync(() => {
            throw new Error("tracking failed");
          }).pipe(Effect.orDie)
        : Effect.void;
    });
    const harness = makeHarness({
      disconnect,
      initialConnection: (connector) => connectedConnection({ connector }),
      trackEvent,
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          yield* waitForState(wallet, (state) => state.status === "connected");
          yield* waitForCondition(() => trackingAttempts === 1);

          harness.emitConnection(disconnectedConnection);
          yield* waitForState(
            wallet,
            (state) => state.status === "disconnected"
          );
          harness.emitConnection(
            connectedConnection({
              address: secondAddress,
              connector: harness.connector,
            })
          );
          yield* waitForCondition(() => trackingAttempts === 2);

          harness.emitConnection(
            connectedConnection({
              chain: optimism,
              connector: harness.connector,
            })
          );
          yield* waitForCondition(() => disconnectAttempts === 1);
          harness.emitConnection(disconnectedConnection);
          yield* waitForState(
            wallet,
            (state) => state.status === "disconnected"
          );
          harness.emitConnection(
            connectedConnection({
              chain: optimism,
              connector: harness.connector,
            })
          );
          yield* waitForCondition(() => disconnectAttempts === 2);

          const current = yield* wallet.current;
          expect(current.phase).toBe("Ready");
        })
      ).pipe(Effect.provide(harness.layer))
    );
  });

  it("interrupts in-flight lifecycle effects when its runtime scope closes", async () => {
    const started = await Effect.runPromise(Deferred.make<void>());
    const interrupted = await Effect.runPromise(Ref.make(false));
    const harness = makeHarness({
      disconnect: () => Effect.void,
      initialConnection: (connector) => connectedConnection({ connector }),
      trackEvent: () =>
        Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Effect.never),
          Effect.onInterrupt(() => Ref.set(interrupted, true))
        ),
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          yield* waitForState(wallet, (state) => state.status === "connected");
          yield* Deferred.await(started);
        })
      ).pipe(Effect.provide(harness.layer))
    );

    expect(await Effect.runPromise(Ref.get(interrupted))).toBe(true);
  });
});
