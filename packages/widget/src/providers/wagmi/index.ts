import {
  type Wallet as SolanaWallet,
  useConnection as useSolanaConnection,
  useWallet as useSolanaWallet,
} from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";
import type {
  Chain as RainbowkitChain,
  Wallet,
  WalletList,
} from "@stakekit/rainbowkit";
import { connectorsForWallets } from "@stakekit/rainbowkit";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import uniqwith from "lodash.uniqwith";
import { createStore } from "mipd";
import { EitherAsync, Just, Left, Maybe, Right } from "purify-ts";
import type { RefObject } from "react";
import { createClient } from "viem";
import { createConfig, http } from "wagmi";
import type { Chain } from "wagmi/chains";
import { mainnet } from "wagmi/chains";
import { getEnabledNetworks } from "../../common/get-enabled-networks";
import { getVariantNetworkUrl } from "../../components/atoms/token-icon/token-icon-container/hooks/use-variant-network-urls";
import { config } from "../../config";
import { evmChainGroup } from "../../domain/types/chains";
import type { CosmosChainsMap } from "../../domain/types/chains/cosmos";
import type { EvmChainsMap } from "../../domain/types/chains/evm";
import type { MiscChainsMap } from "../../domain/types/chains/misc";
import type { Networks } from "../../domain/types/chains/networks";
import type { SubstrateChainsMap } from "../../domain/types/chains/substrate";
import type { SKExternalProviders } from "../../domain/types/wallets";
import { getInitParams } from "../../hooks/get-init-params";
import { useSavedRef } from "../../hooks/use-saved-ref";
import type { GetEitherAsyncRight } from "../../types/utils";
import { isLedgerDappBrowserProvider } from "../../utils";
import type { ApiClient } from "../api/api-client";
import { useApiClient } from "../api/api-client-provider";
import { getConfig as getCosmosConfig } from "../cosmos/config";
import { getConfig as getEvmConfig } from "../ethereum/config";
import { externalProviderConnector } from "../external-provider";
import { getConfig as getLedgerLiveConfig } from "../ledger/config";
import { getConfig as getMiscConfig } from "../misc/config";
import { useSKQueryClient } from "../query-client";
import { getConfig as getSafeConnector } from "../safe/config";
import { useSettings } from "../settings";
import type { SettingsProps, VariantProps } from "../settings/types";
import { getConfig as getSubstrateConfig } from "../substrate/config";

const mipdStore = createStore();

const omitEnsUniversalResolver = <T extends RainbowkitChain>(chain: T): T => {
  if (!chain.contracts?.ensUniversalResolver) return chain;

  const { ensUniversalResolver: _ensUniversalResolver, ...contracts } =
    chain.contracts;

  // RainbowKit resolves ENS profiles whenever mainnet exposes this contract.
  // We do not render ENS data, and viem's default mainnet RPC is eth.merkle.io.
  return { ...chain, contracts } as T;
};

export type BuildWagmiConfig = typeof buildWagmiConfig;

const buildWagmiConfig = async (opts: {
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
  forceWalletConnectOnly: boolean;
  customConnectors?: (chains: Chain[]) => WalletList;
  queryClient: QueryClient;
  apiClient: ApiClient;
  isLedgerLive: boolean;
  isSafe: boolean;
  chainIconMapping: SettingsProps["chainIconMapping"];
  variant: VariantProps["variant"];
  solanaWallets: SolanaWallet[];
  solanaConnection: Connection;
  mapWalletListFn?: (val: WalletList) => WalletList;
  tonConnectManifestUrl: string | undefined;
}): Promise<{
  evmConfig: GetEitherAsyncRight<ReturnType<typeof getEvmConfig>>;
  cosmosConfig: GetEitherAsyncRight<ReturnType<typeof getCosmosConfig>>;
  miscConfig: GetEitherAsyncRight<ReturnType<typeof getMiscConfig>>;
  substrateConfig: GetEitherAsyncRight<ReturnType<typeof getSubstrateConfig>>;
  wagmiConfig: ReturnType<typeof createConfig>;
  queryParamsInitChainId: number | undefined;
}> => {
  return getEnabledNetworks({
    apiClient: opts.apiClient,
    queryClient: opts.queryClient,
  })
    .chain((networks) =>
      EitherAsync.fromPromise(() =>
        Promise.all([
          getEvmConfig({
            forceWalletConnectOnly: opts.forceWalletConnectOnly,
            queryClient: opts.queryClient,
            variant: opts.variant,
            apiClient: opts.apiClient,
          }),
          getCosmosConfig({
            forceWalletConnectOnly: opts.forceWalletConnectOnly,
            queryClient: opts.queryClient,
            apiClient: opts.apiClient,
          }),
          getMiscConfig({
            enabledNetworks: networks,
            queryClient: opts.queryClient,
            forceWalletConnectOnly: opts.forceWalletConnectOnly,
            solanaWallets: opts.solanaWallets,
            solanaConnection: opts.solanaConnection,
            variant: opts.variant,
            tonConnectManifestUrl: opts.tonConnectManifestUrl,
          }),
          getSubstrateConfig({
            queryClient: opts.queryClient,
            forceWalletConnectOnly: opts.forceWalletConnectOnly,
            apiClient: opts.apiClient,
          }),
          getInitParams({
            isLedgerLive: opts.isLedgerLive,
            queryClient: opts.queryClient,
            apiClient: opts.apiClient,
            externalProviders: opts.externalProviders?.current,
          }),
        ]).then(([evm, cosmos, misc, substrate, queryParams]) =>
          evm.chain((e) =>
            cosmos.chain((c) =>
              misc.chain((m) =>
                substrate.chain((s) =>
                  queryParams.map((qp) => ({
                    evmConfig: e,
                    cosmosConfig: c,
                    miscConfig: m,
                    substrateConfig: s,
                    queryParams: qp,
                  }))
                )
              )
            )
          )
        )
      )
    )
    .chain((val) =>
      getLedgerLiveConfig({
        enabledChainsMap: {
          evm: val.evmConfig.evmChainsMap,
          cosmos: val.cosmosConfig.cosmosChainsMap,
          misc: val.miscConfig.miscChainsMap,
          substrate: val.substrateConfig.substrateChainsMap,
        },
        queryClient: opts.queryClient,
        queryParams: val.queryParams,
      }).map((l) => ({ ...val, ledgerLiveConnector: l }))
    )
    .chain((val) =>
      EitherAsync.liftEither(Maybe.fromFalsy(opts.isSafe).toEither(null))
        .chain(() => getSafeConnector({ queryClient: opts.queryClient }))
        .chainLeft((e) => EitherAsync.liftEither(e ? Left(e) : Right(null)))
        .map((s) => ({ ...val, safeConnector: s }))
    )
    .map((val) => {
      const {
        evmConfig,
        cosmosConfig,
        miscConfig,
        substrateConfig,
        ledgerLiveConnector,
      } = val;

      const chains = Maybe.fromNullable(opts.chainIconMapping)
        .map((chainIconMapping) => {
          const mapWagmiChain = (val: {
            wagmiChain: RainbowkitChain;
            skChainName: Networks;
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
        })
        .orDefaultLazy(() => {
          return [
            ...evmConfig.evmChains,
            ...cosmosConfig.cosmosWagmiChains,
            ...miscConfig.miscChains,
            ...substrateConfig.substrateChains,
          ] as [RainbowkitChain, ...RainbowkitChain[]];
        });

      const chainsWithoutEnsProfileLookups = chains.map(
        omitEnsUniversalResolver
      ) as [RainbowkitChain, ...RainbowkitChain[]];

      const multiInjectedProviderDiscovery =
        !opts.disableInjectedProviderDiscovery &&
        !opts.externalProviders &&
        !val.ledgerLiveConnector &&
        !val.safeConnector &&
        opts.variant !== "porto";

      const walletList = Just(null)
        .map(() => {
          if (evmConfig.fineryWallets) {
            return [
              {
                groupName: "Primary",
                wallets: evmConfig.fineryWallets.primaryWallets,
              },
              {
                groupName: "Other",
                wallets: evmConfig.fineryWallets.otherWallets,
              },
              ...Maybe.catMaybes(miscConfig.connectors),
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

          return Maybe.catMaybes([
            evmConfig.connector,
            cosmosConfig.connector,
            substrateConfig.connector,
            ...miscConfig.connectors,
          ]).filter((v) => v.wallets.length > 0);
        })
        .map((walletList) =>
          walletList.map((val): WalletList[number] => ({
            ...val,
            wallets: val.wallets.map(
              (createWalletFn) => (createWalletParams) => {
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
              }
            ),
          }))
        )
        .map((walletList) => opts.mapWalletListFn?.(walletList) ?? walletList)
        .map((walletList) => {
          return walletList.map((wg) => ({
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
        })
        .orDefault([]);

      const queryParamsInitChainId = Maybe.fromNullable(val.queryParams.network)
        .chainNullable(
          (n) =>
            val.evmConfig.evmChainsMap[n as keyof EvmChainsMap] ??
            val.cosmosConfig.cosmosChainsMap[n as keyof CosmosChainsMap] ??
            val.miscConfig.miscChainsMap[n as keyof MiscChainsMap] ??
            val.substrateConfig.substrateChainsMap[
              n as keyof SubstrateChainsMap
            ]
        )
        .map((c) => c.wagmiChain.id)
        .extract();

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
        wagmiConfig._internal.connectors.setState((prev) => [
          ...prev,
          ...uniqwith(
            mipdStore.getProviders(),
            (a, b) => a.info.rdns === b.info.rdns
          ).map((p) => ({
            rkDetails: { chainGroup: evmChainGroup },
            ...wagmiConfig._internal.connectors.setup(
              wagmiConfig._internal.connectors.providerDetailToConnector(p)
            ),
          })),
        ]);

        mipdStore.subscribe((providers) => {
          wagmiConfig._internal.connectors.setState((prev) => [
            ...prev,
            ...uniqwith(providers, (a, b) => a.info.rdns === b.info.rdns).map(
              (p) => ({
                rkDetails: { chainGroup: evmChainGroup },
                ...wagmiConfig._internal.connectors.setup(
                  wagmiConfig._internal.connectors.providerDetailToConnector(p)
                ),
              })
            ),
          ]);
        });
      }

      return {
        ...val,
        wagmiConfig,
        queryParamsInitChainId,
      };
    })
    .caseOf({
      Right: async (val) => val,
      Left: (l) => {
        console.log(l);
        return Promise.reject(l);
      },
    });
};

const queryKey = [config.appPrefix, "wagmi-config"];
const staleTime = Number.POSITIVE_INFINITY;

export const useWagmiConfig = () => {
  const {
    wagmi,
    externalProviders,
    isSafe,
    disableInjectedProviderDiscovery,
    mapWalletFn,
    chainIconMapping,
    variant,
    mapWalletListFn,
    tonConnectManifestUrl,
  } = useSettings();
  const solanaWallets = useSolanaWallet();
  const solanaConnection = useSolanaConnection();

  const queryClient = useSKQueryClient();
  const apiClient = useApiClient();

  const externalProvidersRef = useSavedRef(externalProviders) as
    | RefObject<SKExternalProviders>
    | RefObject<undefined>;

  const wagmiConfigQuery = useQuery({
    staleTime,
    queryKey,
    queryFn: () =>
      buildWagmiConfig({
        mapWalletFn,
        disableInjectedProviderDiscovery: !!disableInjectedProviderDiscovery,
        forceWalletConnectOnly: !!wagmi?.forceWalletConnectOnly,
        customConnectors: wagmi?.__customConnectors__,
        queryClient,
        apiClient,
        isLedgerLive: isLedgerDappBrowserProvider(),
        isSafe: !!isSafe,
        ...(externalProvidersRef.current && {
          externalProviders: externalProvidersRef,
        }),
        chainIconMapping,
        variant,
        solanaWallets: solanaWallets.wallets,
        solanaConnection: solanaConnection.connection,
        mapWalletListFn,
        tonConnectManifestUrl,
      }),
  });

  return wagmiConfigQuery;
};

export const defaultConfig = createConfig({
  chains: [omitEnsUniversalResolver(mainnet)],
  client: ({ chain }) =>
    createClient({
      chain,
      transport: http(chain.rpcUrls.default.http.find((url) => !!url)),
    }),
});
