import { Duration, Effect, Schedule, Schema } from "effect";
import type { EarnYield } from "../../../../domain/earn/models";
import type { EnabledWalletNetworks } from "../../../../domain/wallet/models";
import type { ExternalProviderSnapshot } from "../../../../public-api/external-provider-contract";
import {
  decodeInitParams,
  type InitParams,
  InitParams as InitParamsSchema,
} from "../../../../services/wallet/init-params";
import {
  selectWidgetBootstrapSnapshot,
  type WidgetBootstrapSnapshot as WidgetConfigBootstrapSnapshot,
  WidgetConfigService,
} from "../../../config/widget-config";
import { WidgetPersistence } from "../../../persistence/widget-persistence";
import { WalletBootstrapSource } from "../../wallet-bootstrap-source";
import { SolanaPlatform } from "../platform/solana-platform";
import {
  type WagmiCoreObservation,
  WagmiPlatform,
} from "../platform/wagmi-platform";
import { WalletEnvironment } from "../platform/wallet-environment";
import { installSolanaConnectorMembership } from "./solana-connector-membership";
import type { WalletController } from "./wagmi-config";

export class WalletBootstrapError extends Schema.TaggedError<WalletBootstrapError>()(
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
  readonly config: WidgetConfigBootstrapSnapshot;
  readonly enabledNetworks: EnabledWalletNetworks;
  readonly externalProviders: MutableExternalProviderRef | undefined;
  readonly initParams: InitParams;
};

export type WalletBootstrapResult = {
  readonly controller: WalletController;
  readonly core: WagmiCoreObservation;
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

export const bootstrapWallet = Effect.gen(function* () {
  const config = yield* WidgetConfigService;
  const environment = yield* WalletEnvironment;
  const bootstrapSource = yield* WalletBootstrapSource;
  const persistence = yield* WidgetPersistence;
  const solana = yield* SolanaPlatform;
  const wagmi = yield* WagmiPlatform;
  const settings = yield* config.current;
  const [href, isMobileWallet] = yield* Effect.all([
    environment.href,
    environment.isMobileWallet,
  ]);
  const configSnapshot = selectWidgetBootstrapSnapshot(settings);
  const browser = Object.freeze({
    href,
    isLedgerDappBrowser: configSnapshot.wallet.isLedgerLive,
    isMobileWallet,
  });
  const initParams = decodeInitParams({
    externalProviderInitToken: configSnapshot.wallet.externalProviderInitToken,
    href: browser.href,
  });
  const externalProviderSnapshot = settings.externalProviders;
  const externalProviders = externalProviderSnapshot
    ? ({
        current: externalProviderSnapshot,
      } satisfies MutableExternalProviderRef)
    : undefined;
  const enabledNetworks = yield* bootstrapSource
    .getEnabledWalletNetworks()
    .pipe(
      Effect.retry(enabledNetworksRetrySchedule),
      Effect.mapError(
        (cause) =>
          new WalletBootstrapError({ cause, stage: "enabled-networks" })
      )
    );
  const queryParams = yield* resolveWalletInitParams(
    initParams,
    bootstrapSource.getOpportunity
  ).pipe(
    Effect.mapError(
      (cause) =>
        new WalletBootstrapError({ cause, stage: "initial-parameters" })
    )
  );
  const snapshot = Object.freeze({
    browser,
    config: Object.freeze({
      ...configSnapshot,
      api: Object.freeze(configSnapshot.api),
      tracking: Object.freeze(configSnapshot.tracking),
      wallet: Object.freeze(configSnapshot.wallet),
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
    externalProviders,
    snapshot,
  };
});
