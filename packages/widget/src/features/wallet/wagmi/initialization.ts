import type { Connection } from "@solana/web3.js";
import { Data, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { Connector, createConfig } from "wagmi";
import {
  dynamicExternalProviderInputAtom,
  solanaWalletInputAtom,
  widgetBootstrapConfigAtom,
} from "../../../app/runtime";
import type { CurrentRef } from "../../../domain/types/external-providers";
import type { SKExternalProviders } from "../../../public-api/types";
import {
  isLedgerDappBrowserProvider,
  isMobileWalletEnvironment,
} from "../../../services/wallet/browser-environment";
import { configMeta as safeConfigMeta } from "../../../services/wallet/connectors/safe/safe-connector-meta";
import {
  type WagmiActionOperations,
  wagmiActionOperations,
} from "../../../services/wallet/wagmi-actions";
import type { BuildWagmiConfigOptions } from "../../../services/wallet/wagmi-config";

export class WalletInitializationError extends Data.TaggedError(
  "WalletInitializationError"
)<{
  readonly cause: unknown;
  readonly phase:
    | "configuration"
    | "initial-chain-switch"
    | "mobile-fallback-connect"
    | "reconnect";
}> {}

type WalletInitializationKeyFields = Omit<
  BuildWagmiConfigOptions,
  "enabledNetworks" | "persistPublicKey" | "queryParams"
> & {
  readonly externalProviderInitToken: string | null;
  readonly hasExternalProvider: boolean;
};

export class WalletInitializationKey extends Data.Class<WalletInitializationKeyFields> {}

export const walletInitializationKeyAtom = (() => {
  const externalProviderRefs = new WeakMap<
    object,
    { current: SKExternalProviders | undefined }
  >();

  return Atom.make((get) => {
    const { wallet: config } = get(widgetBootstrapConfigAtom);
    const dynamicExternalProvider = get(dynamicExternalProviderInputAtom);
    const solana = get(solanaWalletInputAtom);
    const externalProviders = dynamicExternalProvider
      ? {
          ...dynamicExternalProvider,
          currentChain: dynamicExternalProvider.currentChain ?? undefined,
          initToken: config.externalProviderInitToken ?? undefined,
          supportedChainIds:
            dynamicExternalProvider.supportedChainIds === null
              ? undefined
              : [...dynamicExternalProvider.supportedChainIds],
        }
      : undefined;
    const externalProvidersRef = externalProviderRefs.get(get.registry) ?? {
      current: externalProviders,
    };

    externalProvidersRef.current = externalProviders;
    externalProviderRefs.set(get.registry, externalProvidersRef);

    return new WalletInitializationKey({
      mapWalletFn: config.mapWalletFn,
      disableInjectedProviderDiscovery: config.disableInjectedProviderDiscovery,
      forceWalletConnectOnly: config.forceWalletConnectOnly,
      customConnectors: config.customConnectors,
      isLedgerLive: config.isLedgerLive,
      isSafe: config.isSafe,
      ...(externalProviders && {
        externalProviders:
          externalProvidersRef as CurrentRef<SKExternalProviders>,
      }),
      externalProviderInitToken: config.externalProviderInitToken,
      hasExternalProvider: config.hasExternalProvider,
      chainIconMapping: config.chainIconMapping,
      institutionalWallets: config.institutionalWallets,
      variant: config.variant,
      solanaWallets: [...solana.wallets],
      solanaConnection: solana.connection as Connection,
      mapWalletListFn: config.mapWalletListFn,
      tonConnectManifestUrl: config.tonConnectManifestUrl,
    });
  }).pipe(Atom.withLabel("walletInitializationKeyAtom"));
})();

export type WalletInitializationOperations = Pick<
  WagmiActionOperations,
  "connect" | "reconnect" | "switchChain"
> & {
  readonly isLedgerLive: () => boolean;
  readonly isMobile: () => boolean;
};

const walletInitializationOperations: WalletInitializationOperations = {
  connect: wagmiActionOperations.connect,
  isLedgerLive: isLedgerDappBrowserProvider,
  isMobile: isMobileWalletEnvironment,
  reconnect: wagmiActionOperations.reconnect,
  switchChain: wagmiActionOperations.switchChain,
};

export const initializeWallet = ({
  hasExternalProvider,
  operations = walletInitializationOperations,
  queryParamsInitChainId,
  wagmiConfig,
}: {
  readonly hasExternalProvider: boolean;
  readonly operations?: WalletInitializationOperations;
  readonly queryParamsInitChainId: number | undefined;
  readonly wagmiConfig: ReturnType<typeof createConfig>;
}) =>
  Effect.gen(function* () {
    const reconnectedCount = yield* Effect.tryPromise({
      try: () => operations.reconnect(wagmiConfig),
      catch: (cause) =>
        new WalletInitializationError({ cause, phase: "reconnect" }),
    }).pipe(
      Effect.match({
        onFailure: () => 0,
        onSuccess: (connections) => connections.length,
      })
    );

    if (
      !hasExternalProvider &&
      reconnectedCount === 0 &&
      !operations.isLedgerLive() &&
      operations.isMobile()
    ) {
      const injectedConnector = wagmiConfig.connectors.find(
        (connector: Connector) =>
          connector.id === "injected" || connector.id === safeConfigMeta.id
      );

      if (injectedConnector) {
        yield* Effect.tryPromise({
          try: () =>
            operations.connect(wagmiConfig, {
              connector: injectedConnector,
              chainId: queryParamsInitChainId,
            }),
          catch: (cause) =>
            new WalletInitializationError({
              cause,
              phase: "mobile-fallback-connect",
            }),
        }).pipe(Effect.ignore);
      }
    }

    if (
      queryParamsInitChainId &&
      wagmiConfig.state.chainId !== queryParamsInitChainId
    ) {
      yield* Effect.tryPromise({
        try: () =>
          operations.switchChain(wagmiConfig, {
            chainId: queryParamsInitChainId,
          }),
        catch: (cause) =>
          new WalletInitializationError({
            cause,
            phase: "initial-chain-switch",
          }),
      }).pipe(Effect.ignore);
    }
  });
