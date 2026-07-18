import {
  Cause,
  Duration,
  Effect,
  Equal,
  Schedule,
  Schema,
  type Scope,
  type Stream,
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
  WidgetConfigService,
} from "../config/widget-config";
import { WidgetPersistence } from "../persistence/widget-persistence";
import {
  isLedgerDappBrowserProvider,
  isMobileWalletEnvironment,
} from "./browser-environment";
import {
  bootstrappingWalletRuntimeSnapshot,
  type WalletCoreProjection,
  type WalletRuntimeSnapshot,
} from "./domain/runtime";
import { initializeWallet } from "./initialization";
import { makeDefaultHeadlessSolanaRuntime } from "./solana-runtime";
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

export type WalletRuntimeAdapters = {
  readonly environment: WalletRuntimeEnvironmentAdapter;
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
  readonly changes: Stream.Stream<WalletRuntimeSnapshot>;
  readonly config: Effect.Effect<Config | null>;
  readonly legacyController: Effect.Effect<WalletController | null>;
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
  Scope.Scope | WidgetConfigService | WidgetPersistence
> {
  const config = yield* WidgetConfigService;
  const persistence = yield* WidgetPersistence;
  const source = makeCurrentValueStream<WalletRuntimeSnapshot>(
    bootstrappingWalletRuntimeSnapshot
  );
  let legacyController: WalletController | null = null;

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
    const externalProviderSnapshot = settings.externalProviders
      ? Object.freeze({
          ...settings.externalProviders,
          supportedChainIds: settings.externalProviders.supportedChainIds
            ? [...settings.externalProviders.supportedChainIds]
            : undefined,
        })
      : undefined;
    const externalProviders = externalProviderSnapshot
      ? ({
          current: externalProviderSnapshot,
        } satisfies CurrentRef<SKExternalProviders>)
      : undefined;
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
    const solanaRuntime = yield* makeDefaultHeadlessSolanaRuntime();
    const controller = yield* adapters.wagmi.buildConfig({
      ...bootstrapSnapshot.config.wallet,
      enabledNetworks: bootstrapSnapshot.enabledNetworks,
      externalProviders: bootstrapSnapshot.externalProviders,
      persistPublicKey: (input) =>
        Effect.runPromise(persistence.upsertStoredPublicKey(input)),
      queryParams: bootstrapSnapshot.initParams,
      solanaConnection: solanaRuntime.connection,
      solanaWallets: [],
    });
    const readySnapshot = (projection: WalletCoreProjection) =>
      ({
        cause: null,
        phase: "Ready",
        projection,
        wagmiConfig: controller.wagmiConfig,
      }) as const satisfies WalletRuntimeSnapshot;
    const publishReady = (projection: WalletCoreProjection) => {
      const current = source.get();
      if (
        current.phase === "Ready" &&
        Equal.equals(current.projection.connection, projection.connection) &&
        Equal.equals(current.projection.connectors, projection.connectors)
      ) {
        return;
      }
      source.set(readySnapshot(projection));
    };
    const watched = yield* watchWalletCore({
      adapters,
      controller,
      publish: publishReady,
    });

    legacyController = controller;
    publishReady(watched.projection);
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
          : Effect.sync(() =>
              source.set({
                cause: Cause.squash(cause),
                phase: "BootstrapFailed",
                projection: null,
                wagmiConfig: null,
              })
            ),
      onSuccess: () => Effect.void,
    })
  );

  yield* bootstrap.pipe(Effect.forkScoped);

  return {
    changes: source.changes,
    config: Effect.sync(() => source.get().wagmiConfig),
    legacyController: Effect.sync(() => legacyController),
    current: Effect.sync(source.get),
  };
});

export const makeBootstrappingWalletRuntime = (): WalletRuntime => {
  const source = makeCurrentValueStream<WalletRuntimeSnapshot>(
    bootstrappingWalletRuntimeSnapshot
  );

  return {
    changes: source.changes,
    config: Effect.succeed(null),
    legacyController: Effect.succeed(null),
    current: Effect.sync(source.get),
  };
};
