import type { Connection } from "@solana/web3.js";
import { Data } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  dynamicExternalProviderInputAtom,
  solanaWalletInputAtom,
  widgetBootstrapConfigAtom,
} from "../../../app/runtime";
import type { CurrentRef } from "../../../domain/types/external-providers";
import type { SKExternalProviders } from "../../../public-api/types";
import type { BuildWagmiConfigOptions } from "../../../services/wallet/wagmi-config";

export {
  initializeWallet,
  type WalletInitializationOperations,
} from "../../../services/wallet/initialization";

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
