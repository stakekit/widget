import { Duration, Effect, Schedule, Schema, type Scope } from "effect";
import type { EarnYield } from "../../../../domain/earn/models";
import type { EnabledNetworks } from "../../../../domain/wallet/models";
import {
  decodeInitParams,
  type InitParams,
  InitParams as InitParamsSchema,
} from "../../../../services/wallet/init-params";
import { LegacyResourceSource } from "../../../api/legacy-resource-source";
import { YieldResourceSource } from "../../../api/yield-resource-source";
import {
  normalizeWidgetBootstrapConfig,
  type WidgetBootstrapConfigValue,
  type WidgetConfig,
  WidgetConfigService,
} from "../../../config/widget-config";
import { WidgetPersistence } from "../../../persistence/widget-persistence";
import type { ExternalProviderSnapshot } from "../../external-provider";
import { SolanaPlatform } from "../platform/solana-platform";
import {
  type WagmiCoreObservation,
  WagmiPlatform,
} from "../platform/wagmi-platform";
import { WalletEnvironment } from "../platform/wallet-environment";
import { installSolanaConnectorMembership } from "./solana-connector-membership";
import type { WalletController } from "./wagmi-config";

export class WalletBootstrapError extends Schema.TaggedErrorClass<WalletBootstrapError>()(
  "WalletBootstrapError",
  {
    cause: Schema.Defect(),
    stage: Schema.Literals([
      "enabled-networks",
      "initial-parameters",
      "solana",
      "wallet-state",
      "wagmi-config",
      "wagmi-observation",
    ]),
  }
) {}

type MutableExternalProviderRef = {
  current: ExternalProviderSnapshot;
};

type WalletBootstrapSnapshot = {
  readonly browser: {
    readonly href: string;
    readonly isLedgerDappBrowser: boolean;
    readonly isMobileWallet: boolean;
  };
  readonly config: WidgetBootstrapConfigValue;
  readonly enabledNetworks: EnabledNetworks;
  readonly externalProviders: MutableExternalProviderRef | undefined;
  readonly initParams: InitParams;
};

export type WalletBootstrapResult = {
  readonly controller: WalletController;
  readonly core: WagmiCoreObservation;
  readonly externalProviderMode: boolean;
  readonly externalProviders: MutableExternalProviderRef | undefined;
  readonly snapshot: WalletBootstrapSnapshot;
};

const enabledNetworksRetrySchedule = Schedule.exponential(
  Duration.millis(100)
).pipe(
  Schedule.upTo({ times: 5 }),
  Schedule.modifyDelay(({ duration }) =>
    Effect.succeed(Duration.min(duration, Duration.seconds(5)))
  )
);

export const makeExternalProviderSnapshot = (
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
  getInitialYield: (
    yieldId: NonNullable<InitParams["yieldId"]>
  ) => Effect.Effect<typeof EarnYield.Type, unknown>
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

export const bootstrapWallet = Effect.fn("bootstrapWallet")(
  function* (): Effect.fn.Return<
    WalletBootstrapResult,
    WalletBootstrapError,
    | LegacyResourceSource
    | Scope.Scope
    | SolanaPlatform
    | WagmiPlatform
    | WalletEnvironment
    | WidgetConfigService
    | WidgetPersistence
    | YieldResourceSource
  > {
    const config = yield* WidgetConfigService;
    const environment = yield* WalletEnvironment;
    const legacySource = yield* LegacyResourceSource;
    const persistence = yield* WidgetPersistence;
    const solana = yield* SolanaPlatform;
    const wagmi = yield* WagmiPlatform;
    const yieldSource = yield* YieldResourceSource;
    const settings = yield* config.current;
    const [href, isMobileWallet] = yield* Effect.all([
      environment.href,
      environment.isMobileWallet,
    ]);
    const normalizedConfig = normalizeWidgetBootstrapConfig({
      isLedgerLive: settings.isLedgerLive,
      settings,
    });
    const browser = Object.freeze({
      href,
      isLedgerDappBrowser: normalizedConfig.wallet.isLedgerLive,
      isMobileWallet,
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
        } satisfies MutableExternalProviderRef)
      : undefined;
    const enabledNetworks = yield* legacySource.getEnabledNetworks().pipe(
      Effect.retry(enabledNetworksRetrySchedule),
      Effect.mapError(
        (cause) =>
          new WalletBootstrapError({ cause, stage: "enabled-networks" })
      )
    );
    const queryParams = yield* resolveWalletInitParams(
      initParams,
      yieldSource.getOpportunity
    ).pipe(
      Effect.mapError(
        (cause) =>
          new WalletBootstrapError({ cause, stage: "initial-parameters" })
      )
    );
    const snapshot = Object.freeze({
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
    const walletConfig = snapshot.config.wallet;
    const includeSolanaWalletAdapters =
      snapshot.enabledNetworks.has("solana") &&
      !walletConfig.hasExternalProvider &&
      !walletConfig.forceWalletConnectOnly &&
      !walletConfig.isLedgerLive &&
      !walletConfig.isSafe &&
      !walletConfig.customConnectors;
    const solanaRuntime = yield* solana
      .makeRuntime({ includeWalletAdapters: includeSolanaWalletAdapters })
      .pipe(
        Effect.mapError(
          (cause) => new WalletBootstrapError({ cause, stage: "solana" })
        )
      );
    const solanaSnapshot = yield* solanaRuntime.current;
    const controller = yield* wagmi
      .buildConfig({
        ...walletConfig,
        enabledNetworks: snapshot.enabledNetworks,
        externalProviders: snapshot.externalProviders,
        persistPublicKey: persistence.upsertStoredPublicKey,
        queryParams: snapshot.initParams,
        solanaConnection: solanaRuntime.connection,
        solanaWallets: solanaSnapshot.wallets,
      })
      .pipe(
        Effect.mapError(
          (cause) => new WalletBootstrapError({ cause, stage: "wagmi-config" })
        )
      );
    const core = yield* wagmi
      .observeCore(controller)
      .pipe(
        Effect.mapError(
          (cause) =>
            new WalletBootstrapError({ cause, stage: "wagmi-observation" })
        )
      );
    if (includeSolanaWalletAdapters && controller.solanaConnectorMode) {
      yield* installSolanaConnectorMembership({
        actions: controller.actions,
        config: controller.wagmiConfig,
        core,
        createConnector: controller.createSolanaConnector,
        runtime: solanaRuntime,
      });
    }
    yield* wagmi.initialize({
      hasExternalProvider: walletConfig.hasExternalProvider,
      isLedgerDappBrowser: browser.isLedgerDappBrowser,
      isMobileWallet: browser.isMobileWallet,
      queryParamsInitChainId: controller.queryParamsInitChainId,
      wagmiConfig: controller.wagmiConfig,
    });

    return {
      controller,
      core,
      externalProviderMode: walletConfig.hasExternalProvider,
      externalProviders,
      snapshot,
    };
  }
);
