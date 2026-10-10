import { Effect, Exit, Option, Schema } from "effect";
import type { Address } from "viem";
import type { Connector, CreateConnectorFn } from "wagmi";
import {
  coinbaseWallet as createCoinbaseConnector,
  injected,
  walletConnect,
} from "wagmi/connectors";
import { evmChainGroup } from "../../../../../services/wallet/evm-chain-group";
import { isMobileWalletEnvironment } from "../../../browser-environment";
import type {
  CreateWalletDescriptor,
  CreateWalletOptions,
  WalletDescriptor,
} from "../../../wallet-descriptors";
import { WalletIntegrationError } from "../../../wallet-errors";
import type { WalletConnectPresentation } from "../../platform/wallet-connect-presentation";
import type { RunWalletEffect } from "../../runtime/effect-runner";
import { wagmiConnectResult } from "../wagmi-connect-result";
import coinbaseWalletIcon from "./icons/coinbase-wallet.svg";
import injectedWalletIcon from "./icons/injected-wallet.svg";
import ledgerWalletIcon from "./icons/ledger-wallet.svg";
import metaMaskWalletIcon from "./icons/meta-mask.svg";
import walletConnectIcon from "./icons/wallet-connect.svg";
import { failWhenProviderMissing } from "./injected-availability";

const withWalletDetails = (
  connector: CreateConnectorFn,
  details: Parameters<WalletDescriptor["createConnector"]>[0]
) =>
  ((config) => ({
    ...connector(config),
    walletDetails: details.walletDetails,
  })) satisfies ReturnType<WalletDescriptor["createConnector"]>;

export type EvmWalletPresentationOptions = {
  readonly walletConnectPresentation: WalletConnectPresentation;
  readonly runWalletEffect: RunWalletEffect;
};

export type EvmWallets = {
  readonly metaMaskWallet: CreateWalletDescriptor;
  readonly ledgerWallet: CreateWalletDescriptor;
  readonly walletConnectWallet: CreateWalletDescriptor;
};

type WalletConnectFactory = ReturnType<typeof walletConnect>;
type WalletConnectRequest = {
  readonly connector: Pick<Connector, "connect" | "disconnect">;
  readonly emitter: Parameters<CreateConnectorFn>[0]["emitter"];
  readonly parameters: Parameters<Connector["connect"]>[0];
  readonly failure: (cause: unknown) => WalletIntegrationError;
};
type SharedWalletConnectConnection = {
  request: WalletConnectRequest;
  readonly effect: Effect.Effect<
    { readonly accounts: readonly Address[]; readonly chainId: number },
    WalletIntegrationError
  >;
};
type SharedWalletConnectFactory = {
  readonly factory: WalletConnectFactory;
  readonly getConnection: (
    request: WalletConnectRequest
  ) => SharedWalletConnectConnection["effect"];
  readonly release: (request: WalletConnectRequest) => void;
};
type GetWalletConnectFactory = (
  options: CreateWalletOptions
) => SharedWalletConnectFactory;

export const createEvmWallets = (
  presentation: EvmWalletPresentationOptions
): EvmWallets => {
  let sharedFactory: SharedWalletConnectFactory | undefined;
  const getFactory: GetWalletConnectFactory = (options) => {
    if (sharedFactory) return sharedFactory;
    let sharedConnection: SharedWalletConnectConnection | undefined;
    let activeRequest: WalletConnectRequest | undefined;
    const factory = walletConnect({
      ...options.walletConnectParameters,
      // EVM approvals share one provider, separate from other protocols.
      customStoragePrefix:
        options.walletConnectParameters?.customStoragePrefix ?? "clientTwo",
      projectId: options.projectId,
      showQrModal: false,
    });
    sharedFactory = {
      factory: (config) => {
        const ignoreAbandonedEvent = () => {};
        const inactiveEmitter = new Proxy(config.emitter, {
          get: (target, property) =>
            property === "emit"
              ? ignoreAbandonedEvent
              : Reflect.get(target, property),
        });
        return factory({
          ...config,
          get emitter() {
            return activeRequest?.emitter ?? inactiveEmitter;
          },
        });
      },
      release(request) {
        if (activeRequest === request) activeRequest = undefined;
      },
      getConnection(request) {
        activeRequest = request;
        if (sharedConnection) {
          sharedConnection.request = request;
          return sharedConnection.effect;
        }
        const connection: SharedWalletConnectConnection = {
          request,
          effect: Effect.suspend(() => {
            const { connector, parameters, failure } = connection.request;
            return Effect.tryPromise({
              try: () =>
                connector.connect({
                  ...parameters,
                  withCapabilities: false,
                }),
              catch: failure,
            });
          }),
        };
        sharedConnection = connection;
        return connection.effect;
      },
    };
    return sharedFactory;
  };
  return {
    metaMaskWallet: createMetaMaskWallet(presentation, getFactory),
    ledgerWallet: createLedgerWallet(presentation, getFactory),
    walletConnectWallet: (options) => ({
      chainGroup: evmChainGroup,
      createConnector: (details) =>
        withWalletDetails(
          createWalletConnectConnector(
            options,
            details,
            presentation,
            getFactory
          ),
          details
        ),
      iconBackground: "#3B99FC",
      iconUrl: walletConnectIcon,
      id: "walletConnect",
      name: "WalletConnect",
      availability: { _tag: "Remote" },
    }),
  };
};

const createWalletConnectConnector =
  (
    options: CreateWalletOptions,
    details: Parameters<WalletDescriptor["createConnector"]>[0],
    presentation: EvmWalletPresentationOptions,
    getFactory: GetWalletConnectFactory
  ): CreateConnectorFn =>
  (config) => {
    const { walletConnectPresentation, runWalletEffect } = presentation;
    const sharedFactory = getFactory(options);
    const connector = sharedFactory.factory(config);

    const failure = (cause: unknown) =>
      new WalletIntegrationError({
        cause,
        message: `Could not connect ${details.walletDetails.name}`,
        operation: "evm-wallet-connect",
      });

    return {
      ...connector,
      connect: (parameters) => {
        const request = {
          connector,
          emitter: config.emitter,
          parameters,
          failure,
        };
        return runWalletEffect(
          walletConnectPresentation
            .connect({
              namespace: "eip155",
              connection: sharedFactory.getConnection(request),
              subscribeUri: (publish) =>
                Effect.gen(function* () {
                  const provider = yield* Effect.tryPromise({
                    try: () => connector.getProvider(),
                    catch: failure,
                  });
                  yield* Effect.acquireRelease(
                    Effect.try({
                      try: () => {
                        provider.on("display_uri", publish);
                      },
                      catch: failure,
                    }),
                    () =>
                      Effect.sync(() =>
                        provider.removeListener("display_uri", publish)
                      )
                  );
                }),
              deepLink: (uri) =>
                (isMobileWalletEnvironment()
                  ? details.walletDetails.mobile?.getUri
                  : details.walletDetails.desktop?.getUri)?.(uri),
            })
            .pipe(
              Effect.map((result) =>
                wagmiConnectResult(
                  parameters?.withCapabilities,
                  result.accounts,
                  result.chainId
                )
              ),
              Effect.onExit((exit) =>
                Exit.isFailure(exit)
                  ? Effect.sync(() => sharedFactory.release(request))
                  : Effect.void
              )
            )
        );
      },
    };
  };

export const injectedWallet: CreateWalletDescriptor = () => ({
  availability: {
    _tag: "Injected",
    detect: Effect.sync(
      () => typeof window !== "undefined" && Boolean(window.ethereum)
    ),
  },
  chainGroup: evmChainGroup,
  createConnector: (details) =>
    withWalletDetails(
      failWhenProviderMissing(
        "injected",
        injected({ shimDisconnect: true }) as CreateConnectorFn
      ),
      details
    ),
  iconBackground: "transparent",
  iconUrl: injectedWalletIcon,
  id: "injected",
  name: "Browser Wallet",
});

const otherWalletFlag = Schema.optional(Schema.Literal(false));
const decodeLegacyMetaMask = Schema.decodeUnknownOption(
  Schema.Struct({
    isMetaMask: Schema.Literal(true),
    isBraveWallet: Schema.optional(Schema.Boolean),
    _events: Schema.optional(Schema.Unknown),
    _state: Schema.optional(Schema.Unknown),
    isApexWallet: otherWalletFlag,
    isAvalanche: otherWalletFlag,
    isBackpack: otherWalletFlag,
    isBifrost: otherWalletFlag,
    isBitKeep: otherWalletFlag,
    isBitski: otherWalletFlag,
    isBinance: otherWalletFlag,
    isBlockWallet: otherWalletFlag,
    isCoinbaseWallet: otherWalletFlag,
    isDawn: otherWalletFlag,
    isEnkrypt: otherWalletFlag,
    isExodus: otherWalletFlag,
    isFrame: otherWalletFlag,
    isFrontier: otherWalletFlag,
    isGamestop: otherWalletFlag,
    isHyperPay: otherWalletFlag,
    isImToken: otherWalletFlag,
    isKuCoinWallet: otherWalletFlag,
    isMathWallet: otherWalletFlag,
    isNestWallet: otherWalletFlag,
    isOkxWallet: otherWalletFlag,
    isOKExWallet: otherWalletFlag,
    isOneInchIOSWallet: otherWalletFlag,
    isOneInchAndroidWallet: otherWalletFlag,
    isOpera: otherWalletFlag,
    isPhantom: otherWalletFlag,
    isZilPay: otherWalletFlag,
    isPortal: otherWalletFlag,
    isxPortal: otherWalletFlag,
    isRabby: otherWalletFlag,
    isRainbow: otherWalletFlag,
    isStatus: otherWalletFlag,
    isTalisman: otherWalletFlag,
    isTally: otherWalletFlag,
    isTokenPocket: otherWalletFlag,
    isTokenary: otherWalletFlag,
    isTrust: otherWalletFlag,
    isTrustWallet: otherWalletFlag,
    isCTRL: otherWalletFlag,
    isZeal: otherWalletFlag,
    isCoin98: otherWalletFlag,
    isMEWwallet: otherWalletFlag,
    isSafeheron: otherWalletFlag,
    isSafePal: otherWalletFlag,
    isWigwam: otherWalletFlag,
    isUniswapWallet: otherWalletFlag,
    isZerion: otherWalletFlag,
    __seif: otherWalletFlag,
  })
);

const isLegacyMetaMask = (provider: unknown): boolean => {
  const metadata = decodeLegacyMetaMask(provider);
  if (Option.isNone(metadata)) return false;
  const { isBraveWallet, _events, _state } = metadata.value;
  return !isBraveWallet || Boolean(_events || _state);
};

const createMetaMaskWallet =
  (
    presentation: EvmWalletPresentationOptions,
    getFactory: GetWalletConnectFactory
  ): CreateWalletDescriptor =>
  (options) => ({
    chainGroup: evmChainGroup,
    createConnector: (details) => (config) => {
      const injectedConnector = injected({
        shimDisconnect: true,
        target: {
          id: "metaMask",
          name: "MetaMask",
          provider(window) {
            const discovered = config.providers.find(
              ({ info }) => info.rdns === "io.metamask"
            );
            if (discovered) return discovered.provider;

            const ethereum = window?.ethereum;
            if (ethereum?.providers)
              return ethereum.providers.find(isLegacyMetaMask);
            return ethereum && isLegacyMetaMask(ethereum)
              ? ethereum
              : undefined;
          },
        },
      })(config);
      const remoteConnector = createWalletConnectConnector(
        options,
        details,
        presentation,
        getFactory
      )(config);
      let activeConnector: ReturnType<CreateConnectorFn> = injectedConnector;
      const selectConnector = async () => {
        activeConnector = (await injectedConnector.getProvider())
          ? injectedConnector
          : remoteConnector;
        return activeConnector;
      };

      return {
        ...injectedConnector,
        rdns: "io.metamask",
        walletDetails: details.walletDetails,
        async setup() {
          const connector = await selectConnector();
          await connector.setup?.();
        },
        async connect(parameters) {
          const connector = await selectConnector();
          const result = await connector.connect({
            ...parameters,
            withCapabilities: false,
          });
          return wagmiConnectResult(
            parameters?.withCapabilities,
            result.accounts,
            result.chainId
          );
        },
        disconnect: () => activeConnector.disconnect(),
        getAccounts: () => activeConnector.getAccounts(),
        getChainId: () => activeConnector.getChainId(),
        getProvider: () => activeConnector.getProvider(),
        async isAuthorized() {
          const connector = await selectConnector();
          return connector.isAuthorized();
        },
        switchChain: (parameters) => activeConnector.switchChain!(parameters),
        onAccountsChanged: (accounts) =>
          activeConnector.onAccountsChanged(accounts),
        onChainChanged: (chainId) => activeConnector.onChainChanged(chainId),
        onDisconnect: (error) => activeConnector.onDisconnect(error),
      };
    },
    iconBackground: "#fff",
    iconUrl: metaMaskWalletIcon,
    id: "metaMask",
    name: "MetaMask",
    // Connects through the extension when present, otherwise WalletConnect.
    availability: { _tag: "Remote" },
    rdns: "io.metamask",
    mobile: {
      getUri: (uri) =>
        `https://metamask.app.link/wc?uri=${encodeURIComponent(uri)}`,
    },
  });

export const coinbaseWallet: CreateWalletDescriptor = ({
  appName,
  appIcon,
}) => ({
  chainGroup: evmChainGroup,
  createConnector: (details) =>
    ((config) => ({
      ...createCoinbaseConnector({ appName, appLogoUrl: appIcon })(config),
      walletDetails: details.walletDetails,
    })) satisfies ReturnType<WalletDescriptor["createConnector"]>,
  iconBackground: "#0052FF",
  iconUrl: coinbaseWalletIcon,
  id: "coinbase",
  name: "Coinbase Wallet",
  availability: { _tag: "Remote" },
  rdns: "com.coinbase.wallet",
});

const createLedgerWallet =
  (
    presentation: EvmWalletPresentationOptions,
    getFactory: GetWalletConnectFactory
  ): CreateWalletDescriptor =>
  (options) => ({
    chainGroup: evmChainGroup,
    createConnector: (details) =>
      withWalletDetails(
        createWalletConnectConnector(
          options,
          details,
          presentation,
          getFactory
        ),
        details
      ),
    iconBackground: "#000",
    iconUrl: ledgerWalletIcon,
    id: "ledger",
    name: "Ledger",
    availability: { _tag: "Remote" },
    rdns: "com.ledger",
    mobile: {
      getUri: (uri) =>
        /android/i.test(navigator.userAgent)
          ? uri
          : `ledgerlive://wc?uri=${encodeURIComponent(uri)}`,
    },
    desktop: {
      getUri: (uri) => `ledgerlive://wc?uri=${encodeURIComponent(uri)}`,
    },
  });
