import type { Wallet as SolanaWallet } from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";
import type {
  Chain as RainbowkitChain,
  Wallet,
  WalletList,
} from "@stakekit/rainbowkit";
import { connectorsForWallets } from "@stakekit/rainbowkit";
import { Effect } from "effect";
import uniqwith from "lodash.uniqwith";
import { createStore, type Store as MipdStore } from "mipd";
import type { RefObject } from "react";
import { createClient } from "viem";
import { createConfig, http } from "wagmi";
import type { Chain } from "wagmi/chains";
import { getVariantNetworkUrl } from "../../../components/atoms/token-icon/token-icon-container/hooks/use-variant-network-urls";
import { config } from "../../../config";
import type { WalletAddress } from "../../../domain/schema/identifiers";
import type { Network } from "../../../domain/schema/network-model";
import type {
  EnabledNetworks,
  WalletInitParams,
} from "../../../domain/schema/wallet-models";
import { evmChainGroup } from "../../../domain/types/chains";
import type { CosmosChainsMap } from "../../../domain/types/chains/cosmos";
import type { EvmChainsMap } from "../../../domain/types/chains/evm";
import type { MiscChainsMap } from "../../../domain/types/chains/misc";

import type { SubstrateChainsMap } from "../../../domain/types/chains/substrate";
import type { SKExternalProviders } from "../../../domain/types/wallets";
import { getConfig as getCosmosConfig } from "../../cosmos/config";
import { getConfig as getEvmConfig } from "../../ethereum/config";
import { externalProviderConnector } from "../../external-provider";
import { getConfig as getLedgerLiveConfig } from "../../ledger/config";
import { getConfig as getMiscConfig } from "../../misc/config";
import { getConfig as getSafeConnector } from "../../safe/config";
import type { SettingsProps, VariantProps } from "../../settings/types";
import { getConfig as getSubstrateConfig } from "../../substrate/config";
import { makeWagmiActions } from "./actions";
import { omitEnsUniversalResolver } from "./default-config";

type MipdProviders = ReturnType<MipdStore["getProviders"]>;

export const scopedMipdSubscription = ({
  initialProviders,
  publish,
  subscribe,
}: {
  readonly initialProviders: MipdProviders;
  readonly publish: (providers: MipdProviders) => void;
  readonly subscribe: (
    onProviders: (providers: MipdProviders) => void
  ) => () => void;
}) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      let isActive = true;
      const publishWhileActive = (providers: MipdProviders) => {
        if (isActive) {
          publish(providers);
        }
      };

      publishWhileActive(initialProviders);
      const unsubscribe = subscribe(publishWhileActive);

      return () => {
        isActive = false;
        unsubscribe();
      };
    }),
    (dispose) => Effect.sync(dispose)
  ).pipe(Effect.asVoid);

const withoutEmptyWalletGroups = (walletList: WalletList): WalletList =>
  walletList.filter((walletGroup) => walletGroup.wallets.length > 0);

export type BuildWagmiConfigOptions = {
  disableInjectedProviderDiscovery: boolean;
  mapWalletFn?: (props: {
    id: string;
    iconUrl: string | (() => Promise<string>);
    name: string;
    iconBackground: string;
  }) => {
    iconUrl: string | (() => Promise<string>);
    name: string;
    iconBackground: string;
  };
  externalProviders?: RefObject<SKExternalProviders>;
  enabledNetworks: EnabledNetworks;
  forceWalletConnectOnly: boolean;
  customConnectors?: (chains: Chain[]) => WalletList;
  isLedgerLive: boolean;
  isSafe: boolean;
  chainIconMapping: SettingsProps["chainIconMapping"];
  institutionalWallets: boolean;
  variant: VariantProps["variant"];
  solanaWallets: SolanaWallet[];
  solanaConnection: Connection;
  mapWalletListFn?: (val: WalletList) => WalletList;
  persistPublicKey: (input: {
    readonly address: WalletAddress;
    readonly publicKey: string;
  }) => Promise<void>;
  queryParams: WalletInitParams;
  tonConnectManifestUrl: string | undefined;
};

export const buildWagmiConfig = (opts: BuildWagmiConfigOptions) =>
  Effect.gen(function* () {
    const [evmConfig, cosmosConfig, miscConfig, substrateConfig] =
      yield* Effect.all(
        [
          getEvmConfig({
            enabledNetworks: opts.enabledNetworks,
            forceWalletConnectOnly: opts.forceWalletConnectOnly,
            institutionalWallets: opts.institutionalWallets,
            variant: opts.variant,
          }),
          getCosmosConfig({
            enabledNetworks: opts.enabledNetworks,
            forceWalletConnectOnly: opts.forceWalletConnectOnly,
            persistPublicKey: opts.persistPublicKey,
          }),
          getMiscConfig({
            enabledNetworks: opts.enabledNetworks,
            forceWalletConnectOnly: opts.forceWalletConnectOnly,
            solanaWallets: opts.solanaWallets,
            solanaConnection: opts.solanaConnection,
            variant: opts.variant,
            tonConnectManifestUrl: opts.tonConnectManifestUrl,
          }),
          getSubstrateConfig({
            enabledNetworks: opts.enabledNetworks,
            forceWalletConnectOnly: opts.forceWalletConnectOnly,
          }),
        ] as const,
        { concurrency: "unbounded" }
      );
    const ledgerLiveConnector = yield* getLedgerLiveConfig({
      enabledChainsMap: {
        evm: evmConfig.evmChainsMap,
        cosmos: cosmosConfig.cosmosChainsMap,
        misc: miscConfig.miscChainsMap,
        substrate: substrateConfig.substrateChainsMap,
      },
      queryParams: opts.queryParams,
    });
    const safeConnector = yield* opts.isSafe
      ? getSafeConnector()
      : Effect.succeed(null);
    const val = {
      enabledNetworks: opts.enabledNetworks,
      evmConfig,
      isLedgerLive: opts.isLedgerLive,
      cosmosConfig,
      miscConfig,
      substrateConfig,
      ledgerLiveConnector,
      safeConnector,
      queryParams: opts.queryParams,
    };

    const chains = opts.chainIconMapping
      ? (() => {
          const chainIconMapping = opts.chainIconMapping;
          const mapWagmiChain = (val: {
            wagmiChain: RainbowkitChain;
            skChainName: Network;
          }) => {
            const res = getVariantNetworkUrl({
              network: val.skChainName,
              chainIconMapping,
            });

            if (res === val.wagmiChain.iconUrl) {
              return val.wagmiChain;
            }

            return {
              ...val.wagmiChain,
              iconBackground: undefined,
              iconUrl: res,
            } as RainbowkitChain;
          };

          return Object.values({
            ...evmConfig.evmChainsMap,
            ...cosmosConfig.cosmosChainsMap,
            ...miscConfig.miscChainsMap,
            ...substrateConfig.substrateChainsMap,
          }).map(mapWagmiChain) as [RainbowkitChain, ...RainbowkitChain[]];
        })()
      : (() => {
          return [
            ...evmConfig.evmChains,
            ...cosmosConfig.cosmosWagmiChains,
            ...miscConfig.miscChains,
            ...substrateConfig.substrateChains,
          ] as [RainbowkitChain, ...RainbowkitChain[]];
        })();

    const chainsWithoutEnsProfileLookups = chains.map(
      omitEnsUniversalResolver
    ) as [RainbowkitChain, ...RainbowkitChain[]];

    const multiInjectedProviderDiscovery =
      !opts.disableInjectedProviderDiscovery &&
      !opts.externalProviders &&
      !val.ledgerLiveConnector &&
      !val.safeConnector &&
      opts.variant !== "porto";

    let walletList: WalletList = (() => {
      if (evmConfig.institutionalWallets) {
        return [
          {
            groupName: "Primary",
            wallets: evmConfig.institutionalWallets.primaryWallets,
          },
          {
            groupName: "Other",
            wallets: evmConfig.institutionalWallets.otherWallets,
          },
          ...miscConfig.connectors.filter((value) => value !== null),
        ];
      }

      if (opts.externalProviders) {
        return [externalProviderConnector(opts.externalProviders)];
      }

      if (val.safeConnector) {
        return [val.safeConnector];
      }

      if (ledgerLiveConnector) {
        return [ledgerLiveConnector];
      }

      if (opts.customConnectors) {
        return opts.customConnectors(chains);
      }

      return [
        evmConfig.connector,
        cosmosConfig.connector,
        substrateConfig.connector,
        ...miscConfig.connectors,
      ]
        .filter((value): value is WalletList[number] => value !== null)
        .filter((value) => value.wallets.length > 0);
    })();
    walletList = walletList.map((val): WalletList[number] => ({
      ...val,
      wallets: val.wallets.map((createWalletFn) => (createWalletParams) => {
        const wallet = createWalletFn(createWalletParams);

        const maybeMapped = opts.mapWalletFn
          ? ({
              ...wallet,
              ...opts.mapWalletFn({
                iconBackground: wallet.iconBackground,
                iconUrl: wallet.iconUrl,
                id: wallet.id,
                name: wallet.name,
              }),
            } satisfies Wallet)
          : wallet;

        return maybeMapped;
      }),
    }));
    walletList = opts.mapWalletListFn?.(walletList) ?? walletList;
    walletList = withoutEmptyWalletGroups(walletList);
    walletList = walletList.map((wg) => ({
      ...wg,
      wallets: wg.wallets.map(
        (createWalletFn): typeof createWalletFn =>
          (details) => {
            const wallet = createWalletFn(details);

            return {
              ...wallet,
              createConnector: (walletDetails) => (config) =>
                wallet.createConnector(walletDetails)({
                  ...config,
                  chains:
                    wallet.chainGroup.id === evmChainGroup.id
                      ? (evmConfig.evmChains as [Chain, ...Chain[]])
                      : config.chains,
                }),
            };
          }
      ),
    }));

    const queryNetwork = val.queryParams.network;
    const queryParamsInitChainId = queryNetwork
      ? (
          val.evmConfig.evmChainsMap[queryNetwork as keyof EvmChainsMap] ??
          val.cosmosConfig.cosmosChainsMap[
            queryNetwork as keyof CosmosChainsMap
          ] ??
          val.miscConfig.miscChainsMap[queryNetwork as keyof MiscChainsMap] ??
          val.substrateConfig.substrateChainsMap[
            queryNetwork as keyof SubstrateChainsMap
          ]
        )?.wagmiChain.id
      : undefined;

    const wagmiConfig = createConfig({
      chains: chainsWithoutEnsProfileLookups,
      client: ({ chain }) => createClient({ chain, transport: http() }),
      multiInjectedProviderDiscovery: false,
      connectors: connectorsForWallets(walletList, {
        appName: config.appName,
        appIcon: config.appIcon,
        projectId: config.walletConnectV2.projectId,
      }),
    });

    if (multiInjectedProviderDiscovery && evmConfig.evmChains.length > 0) {
      const mipdStore = createStore();

      yield* scopedMipdSubscription({
        initialProviders: mipdStore.getProviders(),
        publish: (providers) => {
          wagmiConfig._internal.connectors.setState((prev) => [
            ...prev,
            ...uniqwith(providers, (a, b) => a.info.rdns === b.info.rdns).map(
              (provider) => ({
                rkDetails: { chainGroup: evmChainGroup },
                ...wagmiConfig._internal.connectors.setup(
                  wagmiConfig._internal.connectors.providerDetailToConnector(
                    provider
                  )
                ),
              })
            ),
          ]);
        },
        subscribe: (onProviders) => {
          const unsubscribe = mipdStore.subscribe(onProviders);

          return () => {
            unsubscribe();
            mipdStore.destroy();
          };
        },
      });
    }

    const actions = makeWagmiActions({ config: wagmiConfig });

    return {
      ...val,
      actions,
      wagmiConfig,
      queryParamsInitChainId,
    };
  });

export type WalletController = Effect.Success<
  ReturnType<typeof buildWagmiConfig>
>;
