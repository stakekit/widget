import type { Networks } from "@stakekit/common";
import type { Wallet, WalletList } from "@stakekit/rainbowkit";
import { connectorsForWallets } from "@stakekit/rainbowkit";
import type { Chain as RainbowkitChain } from "@stakekit/rainbowkit";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Left, Maybe, Right } from "purify-ts";
import type { RefObject } from "react";
import { createClient } from "viem";
import { http, createConfig } from "wagmi";
import type { Chain } from "wagmi/chains";
import { mainnet } from "wagmi/chains";
import { getVariantNetworkUrl } from "../../components/atoms/token-icon/token-icon-container/hooks/use-variant-network-urls";
import { config } from "../../config";
import type { CosmosChainsMap } from "../../domain/types/chains/cosmos";
import type { EvmChainsMap } from "../../domain/types/chains/evm";
import type { MiscChainsMap } from "../../domain/types/chains/misc";
import type { SubstrateChainsMap } from "../../domain/types/chains/substrate";
import type { SKExternalProviders } from "../../domain/types/wallets";
import { getInitParams } from "../../hooks/use-init-params";
import { useSavedRef } from "../../hooks/use-saved-ref";
import { useWhitelistedValidators } from "../../hooks/use-whitelisted-validators";
import type { GetEitherAsyncRight } from "../../types/utils";
import { isLedgerDappBrowserProvider } from "../../utils";
import { getEnabledNetworks } from "../api/get-enabled-networks";
import { getConfig as getCosmosConfig } from "../cosmos/config";
import { getConfig as getEvmConfig } from "../ethereum/config";
import { externalProviderConnector } from "../external-provider";
import { getConfig as getLedgerLiveConfig } from "../ledger/config";
import { getConfig as getMiscConfig } from "../misc/config";
import { useSKQueryClient } from "../query-client";
import { getConfig as getSafeConnector } from "../safe/config";
import { useSettings } from "../settings";
import type { SettingsProps } from "../settings/types";
import { getConfig as getSubstrateConfig } from "../substrate/config";

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
  isLedgerLive: boolean;
  isSafe: boolean;
  whitelistedValidatorAddresses: Set<string> | null;
  chainIconMapping: SettingsProps["chainIconMapping"];
}): Promise<{
  evmConfig: GetEitherAsyncRight<ReturnType<typeof getEvmConfig>>;
  cosmosConfig: GetEitherAsyncRight<ReturnType<typeof getCosmosConfig>>;
  miscConfig: GetEitherAsyncRight<ReturnType<typeof getMiscConfig>>;
  substrateConfig: GetEitherAsyncRight<ReturnType<typeof getSubstrateConfig>>;
  wagmiConfig: ReturnType<typeof createConfig>;
  queryParamsInitChainId: number | undefined;
}> => {
  return getEnabledNetworks({
    queryClient: opts.queryClient,
  })
    .chain((networks) =>
      EitherAsync.fromPromise(() =>
        Promise.all([
          getEvmConfig({
            forceWalletConnectOnly: opts.forceWalletConnectOnly,
            queryClient: opts.queryClient,
          }),
          getCosmosConfig({
            forceWalletConnectOnly: opts.forceWalletConnectOnly,
            queryClient: opts.queryClient,
          }),
          getMiscConfig({
            enabledNetworks: networks,
            queryClient: opts.queryClient,
            forceWalletConnectOnly: opts.forceWalletConnectOnly,
          }),
          getSubstrateConfig({
            queryClient: opts.queryClient,
          }),
          getInitParams({
            isLedgerLive: opts.isLedgerLive,
            queryClient: opts.queryClient,
            externalProviders: opts.externalProviders?.current,
            whitelistedValidatorAddresses: opts.whitelistedValidatorAddresses,
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

          return [
            ...Object.values(evmConfig.evmChainsMap).map((val) =>
              mapWagmiChain(val)
            ),
            ...Object.values(cosmosConfig.cosmosChainsMap).map((val) =>
              mapWagmiChain(val)
            ),
            ...Object.values(miscConfig.miscChainsMap).map((val) =>
              mapWagmiChain(val)
            ),
            ...Object.values(substrateConfig.substrateChainsMap).map((val) =>
              mapWagmiChain(val)
            ),
          ] as [RainbowkitChain, ...RainbowkitChain[]];
        })
        .orDefaultLazy(
          () =>
            [
              ...evmConfig.evmChains,
              ...cosmosConfig.cosmosWagmiChains,
              ...miscConfig.miscChains,
              ...substrateConfig.substrateChains,
            ] as [RainbowkitChain, ...RainbowkitChain[]]
        );

      const multiInjectedProviderDiscovery =
        !opts.disableInjectedProviderDiscovery &&
        !opts.externalProviders &&
        !val.ledgerLiveConnector &&
        !val.safeConnector;

      const walletList: WalletList = (() => {
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
          ...miscConfig.connectors,
        ]);
      })().map((val) => ({
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

      return {
        ...val,
        wagmiConfig: createConfig({
          chains,
          client: ({ chain }) => createClient({ chain, transport: http() }),
          multiInjectedProviderDiscovery,
          connectors: connectorsForWallets(walletList, {
            appName: config.appName,
            appIcon: config.appIcon,
            projectId: config.walletConnectV2.projectId,
          }),
        }),
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
  } = useSettings();

  const queryClient = useSKQueryClient();

  const whitelistedValidatorAddresses = useWhitelistedValidators();

  const externalProvidersRef = useSavedRef(externalProviders) as
    | RefObject<SKExternalProviders>
    | RefObject<undefined>;

  return useQuery({
    staleTime,
    queryKey,
    queryFn: () =>
      buildWagmiConfig({
        mapWalletFn,
        disableInjectedProviderDiscovery: !!disableInjectedProviderDiscovery,
        forceWalletConnectOnly: !!wagmi?.forceWalletConnectOnly,
        customConnectors: wagmi?.__customConnectors__,
        queryClient,
        isLedgerLive: isLedgerDappBrowserProvider(),
        isSafe: !!isSafe,
        ...(externalProvidersRef.current && {
          externalProviders: externalProvidersRef,
        }),
        whitelistedValidatorAddresses,
        chainIconMapping,
      }),
  });
};

export const defaultConfig = createConfig({
  chains: [mainnet],
  client: ({ chain }) =>
    createClient({
      chain,
      transport: http(chain.rpcUrls.default.http.find((url) => !!url)),
    }),
});
