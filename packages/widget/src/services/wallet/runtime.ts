import {
  Cause,
  Duration,
  Effect,
  Equal,
  Queue,
  Schedule,
  Schema,
  type Scope,
  Stream,
} from "effect";
import type { Config } from "wagmi";
import {
  getConnection,
  getConnectors,
  watchConnection,
  watchConnectors,
} from "wagmi/actions";
import type { EarnYield } from "../../domain/schema/earn-models";
import type { YieldId } from "../../domain/schema/identifiers";
import {
  decodeInitParams,
  type InitParams,
  InitParams as InitParamsSchema,
} from "../../domain/schema/init-params";
import type { EnabledNetworks } from "../../domain/schema/wallet-models";
import type { CurrentRef } from "../../domain/types/external-providers";
import type { SKExternalProviders } from "../../domain/types/wallets";
import { makeCurrentValueStream } from "../../shared/effect/current-value-stream";
import { LegacyApiService } from "../api/legacy-api-service";
import { YieldApiService } from "../api/yield-api-service";
import {
  normalizeWidgetBootstrapConfig,
  type WidgetBootstrapConfigValue,
  type WidgetConfig,
  WidgetConfigService,
} from "../config/widget-config";
import { WidgetPersistence } from "../persistence/widget-persistence";
import { TrackingService } from "../tracking/tracking-service";
import {
  isLedgerDappBrowserProvider,
  isMobileWalletEnvironment,
} from "./browser-environment";
import { isExternalProviderConnector } from "./connectors/external-provider";
import {
  WalletRuntimeInvariantError,
  WalletRuntimeTerminalError,
} from "./domain/errors";
import {
  bootstrappingWalletRuntimeSnapshot,
  type WalletCoreProjection,
  type WalletProjection,
  type WalletRuntimeSnapshot,
} from "./domain/runtime";
import { disconnectedNormalizedWalletState } from "./domain/state";
import { initializeWallet } from "./initialization";
import { makeWalletLifecyclePolicy } from "./lifecycle";
import type { WalletRoutingContext } from "./router";
import { installSolanaConnectorMembership } from "./solana-connector-membership";
import {
  type HeadlessSolanaRuntime,
  makeDefaultHeadlessSolanaRuntime,
} from "./solana-runtime";
import { makeCompleteWalletStateStream } from "./state-projection";
import {
  type BuildWagmiConfigOptions,
  buildWagmiConfig,
  type WalletController,
} from "./wagmi-config";

type WalletRuntimeEnvironmentAdapter = {
  readonly getEnabledNetworks: () => Effect.Effect<EnabledNetworks, unknown>;
  readonly getHref: () => string;
  readonly getInitialYield: (
    yieldId: YieldId
  ) => Effect.Effect<typeof EarnYield.Type, unknown>;
  readonly isLedgerDappBrowser: () => boolean;
  readonly isMobileWallet: () => boolean;
};

type WalletRuntimeWagmiAdapter = {
  readonly buildConfig: (
    options: BuildWagmiConfigOptions
  ) => Effect.Effect<WalletController, unknown, Scope.Scope>;
  readonly getConnection: (
    config: WalletController["wagmiConfig"]
  ) => WalletCoreProjection["connection"];
  readonly getConnectors: (
    config: WalletController["wagmiConfig"]
  ) => WalletCoreProjection["connectors"];
  readonly initialize: (input: {
    readonly hasExternalProvider: boolean;
    readonly isLedgerDappBrowser: boolean;
    readonly isMobileWallet: boolean;
    readonly queryParamsInitChainId: number | undefined;
    readonly wagmiConfig: WalletController["wagmiConfig"];
  }) => Effect.Effect<void, unknown>;
  readonly watchConnection: (
    config: WalletController["wagmiConfig"],
    onChange: (connection: WalletCoreProjection["connection"]) => void
  ) => () => void;
  readonly watchConnectors: (
    config: WalletController["wagmiConfig"],
    onChange: (connectors: WalletCoreProjection["connectors"]) => void
  ) => () => void;
};

type WalletRuntimeSolanaAdapter = {
  readonly makeRuntime: (options: {
    readonly includeWalletAdapters: boolean;
  }) => Effect.Effect<HeadlessSolanaRuntime, never, Scope.Scope>;
};

export type WalletRuntimeAdapters = {
  readonly environment: WalletRuntimeEnvironmentAdapter;
  readonly solana?: WalletRuntimeSolanaAdapter;
  readonly wagmi: WalletRuntimeWagmiAdapter;
};

const enabledNetworksRetrySchedule = Schedule.exponential(
  Duration.millis(100)
).pipe(
  Schedule.modifyDelay(({ duration }) =>
    Effect.succeed(Duration.min(duration, Duration.seconds(5)))
  )
);

export const makeDefaultWalletRuntimeAdapters = Effect.gen(function* () {
  const legacyApi = yield* LegacyApiService;
  const yieldApi = yield* YieldApiService;

  return {
    environment: {
      getEnabledNetworks: () =>
        legacyApi
          .getEnabledNetworks()
          .pipe(Effect.retry(enabledNetworksRetrySchedule)),
      getHref: () =>
        typeof window === "undefined"
          ? "http://localhost/"
          : window.location.href,
      getInitialYield: yieldApi.getInitialYield,
      isLedgerDappBrowser: () =>
        typeof window !== "undefined" && isLedgerDappBrowserProvider(),
      isMobileWallet: () =>
        typeof window !== "undefined" && isMobileWalletEnvironment(),
    },
    solana: {
      makeRuntime: makeDefaultHeadlessSolanaRuntime,
    },
    wagmi: {
      buildConfig: buildWagmiConfig,
      getConnection,
      getConnectors,
      initialize: initializeWallet,
      watchConnection: (config, onChange) =>
        watchConnection(config, { onChange }),
      watchConnectors: (config, onChange) =>
        watchConnectors(config, { onChange }),
    },
  } satisfies WalletRuntimeAdapters;
});

export type WalletRuntime = {
  readonly captureRouting: Effect.Effect<
    WalletRoutingContext | null,
    WalletRuntimeTerminalError
  >;
  readonly changes: Stream.Stream<WalletRuntimeSnapshot>;
  readonly config: Effect.Effect<Config | null>;
  readonly getState: () => WalletRoutingContext["state"];
  readonly current: Effect.Effect<WalletRuntimeSnapshot>;
};

type WalletBootstrapSnapshot = {
  readonly browser: {
    readonly href: string;
    readonly isLedgerDappBrowser: boolean;
    readonly isMobileWallet: boolean;
  };
  readonly config: WidgetBootstrapConfigValue;
  readonly enabledNetworks: EnabledNetworks;
  readonly externalProviders: CurrentRef<SKExternalProviders> | undefined;
  readonly initParams: InitParams;
};

type ExternalProviderSnapshot = Readonly<SKExternalProviders>;

type MutableCurrentRef<A> = {
  current: A;
};

type WalletRuntimeEvent =
  | {
      readonly _tag: "BootstrapFailed";
      readonly cause: unknown;
    }
  | {
      readonly _tag: "ConnectCompleted";
      readonly address: string;
      readonly key: string;
      readonly succeeded: boolean;
    }
  | {
      readonly _tag: "CoreChanged";
      readonly projection: WalletCoreProjection;
    }
  | {
      readonly _tag: "ExternalProviderChanged";
      readonly snapshot: ExternalProviderSnapshot | undefined;
    }
  | {
      readonly _tag: "Ready";
      readonly controller: WalletController;
      readonly externalProviderMode: boolean;
      readonly externalProviders:
        | MutableCurrentRef<SKExternalProviders>
        | undefined;
      readonly projection: WalletCoreProjection;
    }
  | {
      readonly _tag: "StateChanged";
      readonly projection: WalletProjection;
      readonly revision: number;
      readonly routing: WalletRoutingContext;
    };

type WalletStateInput = {
  readonly controller: WalletController;
  readonly projection: WalletCoreProjection;
  readonly revision: number;
};

const makeExternalProviderSnapshot = (
  settings: WidgetConfig
): ExternalProviderSnapshot | undefined => {
  const externalProviders = settings.externalProviders;
  if (!externalProviders) return undefined;

  return Object.freeze({
    ...externalProviders,
    supportedChainIds: externalProviders.supportedChainIds
      ? [...new Set(externalProviders.supportedChainIds)].sort(
          (first, second) => first - second
        )
      : undefined,
  });
};

const resolveWalletInitParams = Effect.fn("resolveWalletInitParams")(function* (
  initParams: InitParams,
  getInitialYield: WalletRuntimeEnvironmentAdapter["getInitialYield"]
) {
  if (!initParams.yieldId) return initParams;

  const yieldData = yield* getInitialYield(initParams.yieldId).pipe(
    Effect.catch(() => Effect.succeed(null))
  );
  if (!yieldData) return initParams;

  const network = yield* Schema.decodeEffect(InitParamsSchema.fields.network)(
    yieldData.token.network
  );

  return {
    ...initParams,
    network,
    token: yieldData.token.symbol,
  };
});

const watchWalletCore = ({
  adapters,
  controller,
  publish,
}: {
  readonly adapters: WalletRuntimeAdapters;
  readonly controller: WalletController;
  readonly publish: (projection: WalletCoreProjection) => void;
}) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      let connection: WalletCoreProjection["connection"] | null = null;
      let connectors: WalletCoreProjection["connectors"] | null = null;
      let pendingConnection: WalletCoreProjection["connection"] | null = null;
      let pendingConnectors: WalletCoreProjection["connectors"] | null = null;
      let active = true;
      let seeded = false;
      const publishIfSeeded = () => {
        if (active && seeded && connection && connectors) {
          publish({ connection, connectors });
        }
      };
      let unsubscribeConnection: () => void = () => undefined;
      let unsubscribeConnectors: () => void = () => undefined;
      const dispose = () => {
        active = false;
        try {
          unsubscribeConnection();
        } finally {
          unsubscribeConnectors();
        }
      };

      try {
        unsubscribeConnection = adapters.wagmi.watchConnection(
          controller.wagmiConfig,
          (next) => {
            if (!active) return;
            if (!seeded) {
              pendingConnection = next;
              return;
            }
            connection = next;
            publishIfSeeded();
          }
        );
        unsubscribeConnectors = adapters.wagmi.watchConnectors(
          controller.wagmiConfig,
          (next) => {
            if (!active) return;
            if (!seeded) {
              pendingConnectors = next;
              return;
            }
            connectors = next;
            publishIfSeeded();
          }
        );
        connection = adapters.wagmi.getConnection(controller.wagmiConfig);
        connectors = adapters.wagmi.getConnectors(controller.wagmiConfig);
        connection = pendingConnection ?? connection;
        connectors = pendingConnectors ?? connectors;
        seeded = true;
      } catch (cause) {
        try {
          dispose();
        } catch {
          // Preserve the construction failure after attempting every cleanup.
        }
        throw cause;
      }

      return {
        dispose,
        projection: { connection, connectors },
      };
    }),
    ({ dispose }) => Effect.sync(dispose)
  );

export const makeWalletRuntime = Effect.fn("makeWalletRuntime")(function* (
  adapters: WalletRuntimeAdapters
): Effect.fn.Return<
  WalletRuntime,
  never,
  Scope.Scope | TrackingService | WidgetConfigService | WidgetPersistence
> {
  const config = yield* WidgetConfigService;
  const persistence = yield* WidgetPersistence;
  const tracking = yield* TrackingService;
  const lifecycle = makeWalletLifecyclePolicy(tracking);
  const source = makeCurrentValueStream<WalletRuntimeSnapshot>(
    bootstrappingWalletRuntimeSnapshot
  );
  const coreChanges = makeCurrentValueStream<WalletCoreProjection | null>(null);
  const stateInputs = makeCurrentValueStream<WalletStateInput | null>(null);
  const events = yield* Effect.acquireRelease(
    Queue.bounded<WalletRuntimeEvent>(32),
    Queue.shutdown
  );
  let controller: WalletController | null = null;
  let coreProjection: WalletCoreProjection | null = null;
  let publishedProjection: WalletProjection | null = null;
  let routing: WalletRoutingContext | null = null;
  let stateRevision = 0;
  let externalProviderMode: boolean | null = null;
  let externalProviders: MutableCurrentRef<SKExternalProviders> | undefined;
  let pendingExternalProviderSnapshot: ExternalProviderSnapshot | undefined;
  let hasPendingExternalProviderSnapshot = false;
  let pendingCoreProjection: WalletCoreProjection | null = null;
  let connecting: {
    readonly address: string;
    readonly completed: boolean;
    readonly key: string;
  } | null = null;
  let supportedChainsNotification: string | null = null;
  let accountNotification: string | null = null;
  let chainNotification: string | null = null;
  let terminal = false;

  const publishReady = () => {
    if (terminal || !controller || !publishedProjection) return;

    const current = source.get();
    if (
      current.phase === "Ready" &&
      Equal.equals(current.projection, publishedProjection)
    ) {
      return;
    }

    source.set({
      cause: null,
      phase: "Ready",
      projection: publishedProjection,
      wagmiConfig: controller.wagmiConfig,
    });
  };

  const enterInvariant = Effect.fn("WalletRuntime.enterInvariant")(function* (
    reason: WalletRuntimeInvariantError["reason"]
  ) {
    if (terminal) return;

    terminal = true;
    connecting = null;
    const cause = new WalletRuntimeInvariantError({ reason });
    yield* Effect.logError("Wallet Runtime invariant violated").pipe(
      Effect.annotateLogs({
        event: "wallet_runtime_invariant_violated",
        reason,
      })
    );
    source.set({
      cause,
      phase: "InvariantViolated",
      projection: publishedProjection,
      wagmiConfig: controller?.wagmiConfig ?? null,
    });
  });

  const runConnectorNotification = (notify: () => void) =>
    Effect.try({
      try: notify,
      catch: () => undefined,
    }).pipe(Effect.ignore);

  const synchronizeExternalProvider = Effect.fn(
    "WalletRuntime.synchronizeExternalProvider"
  )(function* () {
    if (
      terminal ||
      externalProviderMode !== true ||
      !controller ||
      !coreProjection ||
      !externalProviders
    ) {
      return;
    }

    const matchingConnectors = coreProjection.connectors.filter(
      isExternalProviderConnector
    );
    if (matchingConnectors.length === 0) {
      return yield* enterInvariant("external-provider-connector-missing");
    }
    if (matchingConnectors.length !== 1) {
      return yield* enterInvariant("external-provider-connector-mismatch");
    }

    const connector = matchingConnectors[0];
    if (!connector) {
      return yield* enterInvariant("external-provider-connector-missing");
    }
    const connection = coreProjection.connection;
    if (
      connection.connector &&
      !isExternalProviderConnector(connection.connector)
    ) {
      return yield* enterInvariant("external-provider-connector-mismatch");
    }

    const snapshot = externalProviders.current;
    const currentChainId =
      snapshot.currentChain ??
      connection.chainId ??
      controller.wagmiConfig.state.chainId;
    const supportedChainIds = snapshot.supportedChainIds
      ? [...snapshot.supportedChainIds]
      : [];
    const supportedChainsKey = `${connector.uid}:${currentChainId}:${
      supportedChainIds.join(",") || "all"
    }`;
    if (supportedChainsNotification !== supportedChainsKey) {
      supportedChainsNotification = supportedChainsKey;
      yield* runConnectorNotification(() =>
        connector.onSupportedChainsChanged({
          currentChainId,
          supportedChainIds,
        })
      );
    }

    if (
      connection.status === "disconnected" &&
      snapshot.currentAddress &&
      connecting === null
    ) {
      const key = `${connector.uid}:${snapshot.currentAddress}`;
      connecting = { address: snapshot.currentAddress, completed: false, key };
      yield* controller.actions.connect({ connector }).pipe(
        Effect.match({
          onFailure: () => false,
          onSuccess: () => true,
        }),
        Effect.flatMap((succeeded) =>
          Queue.offer(events, {
            _tag: "ConnectCompleted",
            address: snapshot.currentAddress,
            key,
            succeeded,
          })
        ),
        Effect.forkScoped
      );
      return;
    }

    if (
      connection.status !== "connected" ||
      connection.connector?.uid !== connector.uid
    ) {
      return;
    }

    if (connecting?.completed) connecting = null;
    const accountKey = `${connector.uid}:${connection.address ?? ""}:${snapshot.currentAddress}`;
    if (connection.address === snapshot.currentAddress) {
      accountNotification = null;
    } else if (accountNotification !== accountKey) {
      accountNotification = accountKey;
      yield* runConnectorNotification(() =>
        connector.onAccountsChanged([snapshot.currentAddress])
      );
    }

    const chainKey = `${connector.uid}:${connection.chainId ?? ""}:${
      snapshot.currentChain ?? ""
    }`;
    if (
      snapshot.currentChain === undefined ||
      connection.chainId === snapshot.currentChain
    ) {
      chainNotification = null;
    } else if (chainNotification !== chainKey) {
      chainNotification = chainKey;
      yield* runConnectorNotification(() =>
        connector.onChainChanged(snapshot.currentChain!.toString())
      );
    }
  });

  const applyExternalProviderSnapshot = Effect.fn(
    "WalletRuntime.applyExternalProviderSnapshot"
  )(function* (snapshot: ExternalProviderSnapshot | undefined) {
    if (terminal || externalProviderMode === null) return;

    if ((snapshot !== undefined) !== externalProviderMode) {
      return yield* enterInvariant("external-provider-presence-changed");
    }
    if (!snapshot || !externalProviders) return;

    externalProviders.current = snapshot;
    yield* synchronizeExternalProvider();
  });

  const handleEvent = Effect.fn("WalletRuntime.handleEvent")(function* (
    event: WalletRuntimeEvent
  ) {
    if (terminal) return;

    switch (event._tag) {
      case "BootstrapFailed": {
        terminal = true;
        source.set({
          cause: event.cause,
          phase: "BootstrapFailed",
          projection: null,
          wagmiConfig: null,
        });
        return;
      }
      case "ConnectCompleted": {
        if (connecting?.key !== event.key) return;

        if (
          externalProviders &&
          externalProviders.current.currentAddress !== event.address
        ) {
          connecting = null;
          yield* synchronizeExternalProvider();
        } else if (!event.succeeded) {
          connecting = null;
        } else if (coreProjection?.connection.status === "connected") {
          connecting = null;
        } else {
          connecting = { ...connecting, completed: true };
        }
        return;
      }
      case "CoreChanged": {
        if (!controller) {
          pendingCoreProjection = event.projection;
          return;
        }

        coreProjection = event.projection;
        stateRevision += 1;
        stateInputs.set({
          controller,
          projection: coreProjection,
          revision: stateRevision,
        });
        yield* synchronizeExternalProvider();
        return;
      }
      case "ExternalProviderChanged": {
        if (externalProviderMode === null) {
          pendingExternalProviderSnapshot = event.snapshot;
          hasPendingExternalProviderSnapshot = true;
          return;
        }

        yield* applyExternalProviderSnapshot(event.snapshot);
        return;
      }
      case "Ready": {
        controller = event.controller;
        coreProjection = pendingCoreProjection ?? event.projection;
        pendingCoreProjection = null;
        externalProviderMode = event.externalProviderMode;
        externalProviders = event.externalProviders;
        stateRevision += 1;
        stateInputs.set({
          controller,
          projection: coreProjection,
          revision: stateRevision,
        });

        if (hasPendingExternalProviderSnapshot) {
          yield* applyExternalProviderSnapshot(pendingExternalProviderSnapshot);
        } else {
          yield* synchronizeExternalProvider();
        }
        return;
      }
      case "StateChanged": {
        if (event.revision !== stateRevision) return;

        publishedProjection = event.projection;
        routing = event.routing;
        publishReady();
        const lifecycleEffect = lifecycle.transition({
          actions: event.routing.actions,
          state: event.projection.state,
        });
        if (lifecycleEffect) {
          yield* lifecycleEffect.pipe(Effect.forkScoped);
        }
      }
    }
  });

  const coreEvents = coreChanges.changes.pipe(
    Stream.filter((next): next is WalletCoreProjection => next !== null),
    Stream.map(
      (projection): WalletRuntimeEvent => ({
        _tag: "CoreChanged",
        projection,
      })
    )
  );
  const stateEvents = stateInputs.changes.pipe(
    Stream.filter((input): input is WalletStateInput => input !== null),
    Stream.switchMap((input) =>
      makeCompleteWalletStateStream({
        controller: input.controller,
        projection: input.projection,
        readStoredPublicKeys: persistence.readStoredPublicKeys,
      }).pipe(
        Stream.map(
          ({ projection, routing }): WalletRuntimeEvent => ({
            _tag: "StateChanged",
            projection,
            revision: input.revision,
            routing,
          })
        )
      )
    )
  );
  yield* Stream.mergeAll([Stream.fromQueue(events), coreEvents, stateEvents], {
    bufferSize: 16,
    concurrency: 3,
  }).pipe(Stream.runForEach(handleEvent), Effect.forkScoped);

  const bootstrap = Effect.gen(function* () {
    const settings = yield* config.current;
    const normalizedConfig = normalizeWidgetBootstrapConfig({
      isLedgerLive: settings.isLedgerLive,
      settings,
    });
    const browser = Object.freeze({
      href: adapters.environment.getHref(),
      isLedgerDappBrowser: adapters.environment.isLedgerDappBrowser(),
      isMobileWallet: adapters.environment.isMobileWallet(),
    });
    const initParams = decodeInitParams({
      externalProviderInitToken:
        normalizedConfig.wallet.externalProviderInitToken,
      href: browser.href,
    });
    const externalProviderSnapshot = makeExternalProviderSnapshot(settings);
    const externalProviders = externalProviderSnapshot
      ? ({
          current: externalProviderSnapshot,
        } satisfies MutableCurrentRef<SKExternalProviders>)
      : undefined;
    yield* config.changes.pipe(
      Stream.runForEach((next) =>
        Queue.offer(events, {
          _tag: "ExternalProviderChanged",
          snapshot: makeExternalProviderSnapshot(next),
        })
      ),
      Effect.forkScoped
    );
    const [enabledNetworks, queryParams] = yield* Effect.all([
      adapters.environment.getEnabledNetworks(),
      resolveWalletInitParams(initParams, adapters.environment.getInitialYield),
    ]);
    const bootstrapSnapshot = Object.freeze({
      browser,
      config: Object.freeze({
        ...normalizedConfig,
        api: Object.freeze(normalizedConfig.api),
        tracking: Object.freeze(normalizedConfig.tracking),
        wallet: Object.freeze(normalizedConfig.wallet),
      }),
      enabledNetworks: new Set(enabledNetworks),
      externalProviders,
      initParams: Object.freeze(queryParams),
    } satisfies WalletBootstrapSnapshot);
    const walletConfig = bootstrapSnapshot.config.wallet;
    const includeSolanaWalletAdapters =
      bootstrapSnapshot.enabledNetworks.has("solana") &&
      !walletConfig.hasExternalProvider &&
      !walletConfig.forceWalletConnectOnly &&
      !walletConfig.isLedgerLive &&
      !walletConfig.isSafe &&
      !walletConfig.customConnectors;
    const solanaRuntime = yield* (
      adapters.solana?.makeRuntime ?? makeDefaultHeadlessSolanaRuntime
    )({
      includeWalletAdapters: includeSolanaWalletAdapters,
    });
    const controller = yield* adapters.wagmi.buildConfig({
      ...bootstrapSnapshot.config.wallet,
      enabledNetworks: bootstrapSnapshot.enabledNetworks,
      externalProviders: bootstrapSnapshot.externalProviders,
      persistPublicKey: (input) =>
        Effect.runPromise(persistence.upsertStoredPublicKey(input)),
      queryParams: bootstrapSnapshot.initParams,
      solanaConnection: solanaRuntime.connection,
      solanaWallets: solanaRuntime.getWalletSnapshot().wallets,
    });
    if (includeSolanaWalletAdapters && controller.solanaConnectorMode) {
      yield* installSolanaConnectorMembership({
        config: controller.wagmiConfig,
        createConnector: controller.createSolanaConnector,
        runtime: solanaRuntime,
      });
    }
    const watched = yield* watchWalletCore({
      adapters,
      controller,
      publish: coreChanges.set,
    });

    yield* Queue.offer(events, {
      _tag: "Ready",
      controller,
      externalProviderMode: bootstrapSnapshot.config.wallet.hasExternalProvider,
      externalProviders,
      projection: watched.projection,
    });
    yield* adapters.wagmi
      .initialize({
        hasExternalProvider:
          bootstrapSnapshot.config.wallet.hasExternalProvider,
        isLedgerDappBrowser: bootstrapSnapshot.browser.isLedgerDappBrowser,
        isMobileWallet: bootstrapSnapshot.browser.isMobileWallet,
        queryParamsInitChainId: controller.queryParamsInitChainId,
        wagmiConfig: controller.wagmiConfig,
      })
      .pipe(Effect.ignore, Effect.forkScoped);
  }).pipe(
    Effect.matchCauseEffect({
      onFailure: (cause) =>
        Cause.hasInterruptsOnly(cause)
          ? Effect.void
          : Queue.offer(events, {
              _tag: "BootstrapFailed",
              cause: Cause.squash(cause),
            }),
      onSuccess: () => Effect.void,
    })
  );

  yield* bootstrap.pipe(Effect.forkScoped);

  return {
    captureRouting: Effect.suspend(() => {
      const snapshot = source.get();
      if (
        snapshot.phase === "BootstrapFailed" ||
        snapshot.phase === "InvariantViolated"
      ) {
        return Effect.fail(
          new WalletRuntimeTerminalError({
            cause: snapshot.cause,
            phase: snapshot.phase,
          })
        );
      }

      return Effect.succeed(snapshot.phase === "Ready" ? routing : null);
    }),
    changes: source.changes,
    config: Effect.sync(() => source.get().wagmiConfig),
    getState: () =>
      publishedProjection?.state ?? disconnectedNormalizedWalletState,
    current: Effect.sync(source.get),
  };
});
