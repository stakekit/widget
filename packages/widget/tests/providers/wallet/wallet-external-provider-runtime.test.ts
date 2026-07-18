import {
  Deferred,
  Effect,
  Fiber,
  Layer,
  Logger,
  Option,
  References,
  Stream,
} from "effect";
import { describe, expect, it } from "vitest";
import type { Connector } from "wagmi";
import { getConnection } from "wagmi/actions";
import { normalizeWidgetConfig } from "../../../src/app/config";
import type { SKExternalProviders } from "../../../src/public-api/types";
import {
  type WidgetConfig,
  WidgetConfigService,
} from "../../../src/services/config/widget-config";
import { WidgetPersistence } from "../../../src/services/persistence/widget-persistence";
import { TrackingService } from "../../../src/services/tracking/tracking-service";
import { makeDefaultConfig } from "../../../src/services/wallet/default-wagmi-config";
import type {
  WalletCoreProjection,
  WalletRuntimeSnapshot,
} from "../../../src/services/wallet/domain/runtime";
import {
  type WalletRuntimeAdapters,
  WalletService,
} from "../../../src/services/wallet/wallet-service";
import { makeCurrentValueStream } from "../../../src/shared/effect/current-value-stream";
import { makeRuntimeTestController } from "./runtime-test-controller";

const address = (suffix: string) =>
  `0x${suffix.padStart(40, "0")}` as `0x${string}`;

const makeExternalProvider = (
  overrides: Partial<SKExternalProviders> = {}
): SKExternalProviders => ({
  currentAddress: address("1"),
  currentChain: 1,
  provider: {
    sendTransaction: async () => "transaction-hash",
    signMessage: async () => "signature",
    switchChain: async () => undefined,
  },
  supportedChainIds: [1],
  type: "generic",
  ...overrides,
});

const makeSettings = (
  externalProviders: SKExternalProviders | undefined
): WidgetConfig =>
  normalizeWidgetConfig({
    apiKey: "api-key",
    disableInjectedProviderDiscovery: true,
    externalProviders,
    variant: "default",
  });

const waitForCondition = Effect.fn("waitForCondition")(function* (
  condition: () => boolean
) {
  while (!condition()) yield* Effect.yieldNow;
});

const waitForPhase = (
  wallet: WalletService["Service"],
  phase: WalletRuntimeSnapshot["phase"]
) =>
  wallet.changes.pipe(
    Stream.filter((snapshot) => snapshot.phase === phase),
    Stream.runHead,
    Effect.map(Option.getOrThrow)
  );

type ExternalConnectorHarness = {
  readonly accounts: string[][];
  readonly chains: string[];
  readonly connector: Connector;
  readonly notifications: string[];
  readonly supported: Array<{
    readonly currentChainId: number;
    readonly supportedChainIds: number[];
  }>;
};

const makeExternalConnector = (
  id = "externalProviderConnector",
  throwsOnFirstSupportedChange = false
): ExternalConnectorHarness => {
  const accounts: string[][] = [];
  const chains: string[] = [];
  const notifications: string[] = [];
  const supported: ExternalConnectorHarness["supported"] = [];
  let shouldThrowOnSupportedChange = throwsOnFirstSupportedChange;
  const connector = {
    id,
    name: "External Provider",
    onAccountsChanged: (next: string[]) => {
      accounts.push(next);
      notifications.push(`accounts:${next.join(",")}`);
    },
    onChainChanged: (next: string) => {
      chains.push(next);
      notifications.push(`chain:${next}`);
    },
    onSupportedChainsChanged: (next: {
      currentChainId: number;
      supportedChainIds: number[];
    }) => {
      notifications.push(
        `supported:${next.currentChainId}:${next.supportedChainIds.join(",")}`
      );
      if (shouldThrowOnSupportedChange) {
        shouldThrowOnSupportedChange = false;
        throw new Error("notification failed");
      }
      supported.push(next);
    },
    type: "externalProvider",
    uid: "external-provider-uid",
  } as unknown as Connector;

  return { accounts, chains, connector, notifications, supported };
};

const makeRuntimeHarness = ({
  connect = () => Effect.void,
  connectors,
  initialExternalProvider,
}: {
  readonly connect?: (connector: Connector) => Effect.Effect<void, unknown>;
  readonly connectors: ReadonlyArray<Connector>;
  readonly initialExternalProvider: SKExternalProviders | undefined;
}) => {
  const configSource = makeCurrentValueStream(
    makeSettings(initialExternalProvider)
  );
  const wagmiConfig = makeDefaultConfig();
  let connection: WalletCoreProjection["connection"] =
    getConnection(wagmiConfig);
  let connectionWatcher: ((next: typeof connection) => void) | undefined;
  let connectorsWatcher: ((next: ReadonlyArray<Connector>) => void) | undefined;
  let capturedOptions:
    | Parameters<WalletRuntimeAdapters["wagmi"]["buildConfig"]>[0]
    | undefined;
  const controller = makeRuntimeTestController({
    actions: {
      connect: ({ connector }: { readonly connector: Connector }) =>
        connect(connector),
    },
    queryParamsInitChainId: undefined,
    wagmiConfig,
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
      buildConfig: (options) =>
        Effect.sync(() => {
          capturedOptions = options;
          return controller;
        }),
      getConnection: () => connection,
      getConnectors: () => connectors,
      initialize: () => Effect.void,
      watchConnection: (_config, onChange) => {
        connectionWatcher = onChange;
        return () => undefined;
      },
      watchConnectors: (_config, onChange) => {
        connectorsWatcher = onChange;
        return () => undefined;
      },
    },
  } satisfies WalletRuntimeAdapters;
  const configLayer = WidgetConfigService.layer({
    changes: configSource.changes,
    current: Effect.sync(configSource.get),
    initial: configSource.get(),
  });
  const trackingLayer = TrackingService.layer.pipe(Layer.provide(configLayer));
  const layer = WalletService.layerWithRuntimeAdapters(adapters).pipe(
    Layer.provide(
      Layer.mergeAll(configLayer, trackingLayer, WidgetPersistence.layer)
    )
  );

  return {
    capturedOptions: () => capturedOptions,
    configSource,
    emitConnection: (next: typeof connection) => {
      connection = next;
      connectionWatcher?.(next);
    },
    emitConnectors: (next: ReadonlyArray<Connector>) =>
      connectorsWatcher?.(next),
    layer,
    wagmiConfig,
  };
};

describe("WalletService external-provider ownership", () => {
  it("replaces live provider values and synchronizes ordered connector notifications", async () => {
    const firstProvider = makeExternalProvider();
    const replacementOperations = {
      sendTransaction: async () => "replacement-hash",
      signMessage: async () => "replacement-signature",
      switchChain: async () => undefined,
    };
    const connector = makeExternalConnector();
    let connectCount = 0;
    const harness = makeRuntimeHarness({
      connect: () =>
        Effect.sync(() => {
          connectCount += 1;
        }),
      connectors: [connector.connector],
      initialExternalProvider: firstProvider,
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          yield* waitForPhase(wallet, "Ready");
          yield* waitForCondition(() => connectCount === 1);

          harness.emitConnection({
            ...getConnection(harness.wagmiConfig),
            address: firstProvider.currentAddress as `0x${string}`,
            addresses: [firstProvider.currentAddress as `0x${string}`],
            chainId: 1,
            connector: connector.connector,
            status: "connected",
          } as WalletCoreProjection["connection"]);
          harness.configSource.set(
            makeSettings(
              makeExternalProvider({
                currentAddress: address("2"),
                currentChain: 10,
                provider: replacementOperations,
                supportedChainIds: [10, 1, 10],
              })
            )
          );
          yield* waitForCondition(
            () =>
              connector.notifications.length === 4 &&
              harness.capturedOptions()?.externalProviders?.current.provider ===
                replacementOperations
          );

          const currentRef = harness.capturedOptions()?.externalProviders;
          expect(currentRef?.current).toMatchObject({
            currentAddress: address("2"),
            currentChain: 10,
            provider: replacementOperations,
            supportedChainIds: [1, 10],
          });
          expect(connector.supported).toEqual([
            { currentChainId: 1, supportedChainIds: [1] },
            { currentChainId: 10, supportedChainIds: [1, 10] },
          ]);
          expect(connector.accounts).toEqual([[address("2")]]);
          expect(connector.chains).toEqual(["10"]);
          expect(connector.notifications).toEqual([
            "supported:1:1",
            "supported:10:1,10",
            `accounts:${address("2")}`,
            "chain:10",
          ]);

          const previousSnapshot = currentRef?.current;
          harness.configSource.set(
            makeSettings(
              makeExternalProvider({
                currentAddress: address("2"),
                currentChain: 10,
                provider: replacementOperations,
                supportedChainIds: [1, 10],
              })
            )
          );
          yield* waitForCondition(
            () => currentRef?.current !== previousSnapshot
          );

          expect(connector.supported).toHaveLength(2);
          expect(connector.accounts).toHaveLength(1);
          expect(connector.chains).toHaveLength(1);
          expect(connectCount).toBe(1);
        })
      ).pipe(Effect.provide(harness.layer))
    );
  });

  it("does not start duplicate automatic connections while one is pending", async () => {
    const connectRelease = await Effect.runPromise(Deferred.make<void>());
    const connector = makeExternalConnector();
    let connectCount = 0;
    const provider = makeExternalProvider();
    const harness = makeRuntimeHarness({
      connect: () =>
        Effect.gen(function* () {
          connectCount += 1;
          yield* Deferred.await(connectRelease);
        }),
      connectors: [connector.connector],
      initialExternalProvider: provider,
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          yield* waitForPhase(wallet, "Ready");
          yield* waitForCondition(() => connectCount === 1);
          harness.emitConnection({
            ...getConnection(harness.wagmiConfig),
            address: provider.currentAddress as `0x${string}`,
            addresses: [provider.currentAddress as `0x${string}`],
            chainId: 1,
            connector: connector.connector,
            status: "connected",
          } as WalletCoreProjection["connection"]);
          harness.emitConnection(getConnection(harness.wagmiConfig));
          const latestOperations = {
            ...provider.provider,
            switchChain: async () => undefined,
          };
          harness.configSource.set(makeSettings({ ...provider }));
          harness.configSource.set(
            makeSettings({ ...provider, provider: latestOperations })
          );
          yield* waitForCondition(
            () =>
              harness.capturedOptions()?.externalProviders?.current.provider ===
              latestOperations
          );
          expect(connectCount).toBe(1);
          yield* Deferred.succeed(connectRelease, undefined);
        })
      ).pipe(Effect.provide(harness.layer))
    );
  });

  it("keeps processing events after a connector notification throws", async () => {
    const connector = makeExternalConnector("externalProviderConnector", true);
    const provider = makeExternalProvider();
    const harness = makeRuntimeHarness({
      connectors: [connector.connector],
      initialExternalProvider: provider,
    });

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          yield* waitForPhase(wallet, "Ready");
          harness.configSource.set(
            makeSettings({ ...provider, supportedChainIds: [1, 10] })
          );
          yield* waitForCondition(() => connector.notifications.length === 2);

          expect(connector.supported).toEqual([
            { currentChainId: 1, supportedChainIds: [1, 10] },
          ]);
          expect((yield* wallet.current).phase).toBe("Ready");
        })
      ).pipe(Effect.provide(harness.layer))
    );
  });

  it.each([
    {
      initial: makeExternalProvider(),
      label: "present to absent",
      next: undefined,
    },
    {
      initial: undefined,
      label: "absent to present",
      next: makeExternalProvider(),
    },
  ])("enters a terminal invariant when presence changes $label", async ({
    initial,
    next,
  }) => {
    const connector = makeExternalConnector();
    const harness = makeRuntimeHarness({
      connectors: initial ? [connector.connector] : [],
      initialExternalProvider: initial,
    });

    const snapshot = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          yield* waitForPhase(wallet, "Ready");
          const failed = yield* waitForPhase(wallet, "InvariantViolated").pipe(
            Effect.forkChild({ startImmediately: true })
          );
          harness.configSource.set(makeSettings(next));
          return yield* Fiber.join(failed);
        })
      ).pipe(Effect.provide(harness.layer))
    );

    expect(snapshot).toMatchObject({
      cause: { _tag: "WalletRuntimeInvariantError" },
      phase: "InvariantViolated",
    });
  });

  it("fails immediately when external-provider mode has no matching connector and logs once", async () => {
    const annotations: Array<Record<string, unknown>> = [];
    const logger = Logger.make<unknown, void>((options) => {
      annotations.push({
        ...options.fiber.getRef(References.CurrentLogAnnotations),
      });
    });
    const harness = makeRuntimeHarness({
      connectors: [],
      initialExternalProvider: makeExternalProvider(),
    });

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const failed = yield* waitForPhase(wallet, "InvariantViolated");
          harness.configSource.set(makeSettings(undefined));
          harness.configSource.set(makeSettings(makeExternalProvider()));
          return { current: yield* wallet.current, failed };
        })
      ).pipe(
        Effect.provide(harness.layer),
        Effect.provide(Logger.layer([logger]))
      )
    );

    expect(result.current).toBe(result.failed);
    expect(
      annotations.filter(
        (annotation) => annotation.event === "wallet_runtime_invariant_violated"
      )
    ).toHaveLength(1);
  });

  it.each([
    "connected",
    "connecting",
    "reconnecting",
  ] as const)("fails when a $status connection belongs to another connector", async (status) => {
    const externalConnector = makeExternalConnector();
    const otherConnector = {
      id: "other",
      name: "Other",
      type: "injected",
      uid: "other-uid",
    } as unknown as Connector;
    const harness = makeRuntimeHarness({
      connectors: [externalConnector.connector, otherConnector],
      initialExternalProvider: makeExternalProvider(),
    });

    const snapshot = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          yield* waitForPhase(wallet, "Ready");
          const failed = yield* waitForPhase(wallet, "InvariantViolated").pipe(
            Effect.forkChild({ startImmediately: true })
          );
          harness.emitConnection({
            ...getConnection(harness.wagmiConfig),
            address: address("1"),
            addresses: [address("1")],
            chainId: 1,
            connector: otherConnector,
            status,
          } as WalletCoreProjection["connection"]);
          return yield* Fiber.join(failed);
        })
      ).pipe(Effect.provide(harness.layer))
    );

    expect(snapshot).toMatchObject({
      cause: {
        _tag: "WalletRuntimeInvariantError",
        reason: "external-provider-connector-mismatch",
      },
      phase: "InvariantViolated",
    });
  });

  it("keeps invariant failure isolated to its Wallet Runtime generation", async () => {
    const failedHarness = makeRuntimeHarness({
      connectors: [],
      initialExternalProvider: makeExternalProvider(),
    });
    const healthyHarness = makeRuntimeHarness({
      connectors: [],
      initialExternalProvider: undefined,
    });

    const failed = await Effect.runPromise(
      Effect.scoped(
        WalletService.use((wallet) => waitForPhase(wallet, "InvariantViolated"))
      ).pipe(Effect.provide(failedHarness.layer))
    );
    const healthy = await Effect.runPromise(
      Effect.scoped(
        WalletService.use((wallet) => waitForPhase(wallet, "Ready"))
      ).pipe(Effect.provide(healthyHarness.layer))
    );

    expect(failed.phase).toBe("InvariantViolated");
    expect(healthy.phase).toBe("Ready");
  });
});
