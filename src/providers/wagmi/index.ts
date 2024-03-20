import { createConfig, http } from "wagmi";
import { Chain, mainnet } from "wagmi/chains";
import { getConfig as getEvmConfig } from "../ethereum/config";
import { getConfig as getCosmosConfig } from "../cosmos/config";
import { getConfig as getMiscConfig } from "../misc/config";
import { getConfig as getSubstrateConfig } from "../substrate/config";
import { WalletList, connectorsForWallets } from "@stakekit/rainbowkit";
import { ledgerLiveConnector } from "../ledger/ledger-connector";
import { config } from "../../config";
import { QueryClient, UseQueryResult, useQuery } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";
import { useSettings } from "../settings";
import { GetEitherAsyncRight } from "../../types";
import { isLedgerDappBrowserProvider } from "../../utils";
import { externalProviderConnector } from "../external-provider";
import { getInitialQueryParams } from "../../hooks/use-init-query-params";
import { useSKQueryClient } from "../query-client";
import { SKExternalProviders } from "../../domain/types/wallets/safe-wallet";
import { createClient } from "viem";

export type BuildWagmiConfig = typeof buildWagmiConfig;

const buildWagmiConfig = async (opts: {
  externalProviders?: SKExternalProviders;
  forceWalletConnectOnly: boolean;
  customConnectors?: (chains: Chain[]) => WalletList;
  queryClient: QueryClient;
  isLedgerLive: boolean;
}): Promise<{
  evmConfig: GetEitherAsyncRight<ReturnType<typeof getEvmConfig>>;
  cosmosConfig: GetEitherAsyncRight<ReturnType<typeof getCosmosConfig>>;
  miscConfig: GetEitherAsyncRight<ReturnType<typeof getMiscConfig>>;
  substrateConfig: GetEitherAsyncRight<ReturnType<typeof getSubstrateConfig>>;
  wagmiConfig: ReturnType<typeof createConfig>;
}> => {
  return EitherAsync.fromPromise(() =>
    Promise.all([
      getEvmConfig({
        forceWalletConnectOnly: opts.forceWalletConnectOnly,
        queryClient: opts.queryClient,
      }),
      getCosmosConfig({
        forceWalletConnectOnly: opts.forceWalletConnectOnly,
        queryClient: opts.queryClient,
      }),
      getMiscConfig({ queryClient: opts.queryClient }),
      getSubstrateConfig({ queryClient: opts.queryClient }),
      getInitialQueryParams({
        isLedgerLive: opts.isLedgerLive,
        queryClient: opts.queryClient,
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
  ).caseOf({
    Right: ({
      evmConfig,
      cosmosConfig,
      miscConfig,
      substrateConfig,
      queryParams,
    }) => {
      const chains = [
        ...evmConfig.evmChains,
        ...cosmosConfig.cosmosWagmiChains,
        ...miscConfig.miscChains,
        ...substrateConfig.substrateChains,
      ] as [Chain, ...Chain[]];

      const wagmiConfig = createConfig({
        chains,
        client: ({ chain }) => createClient({ chain, transport: http() }),
        connectors: connectorsForWallets(
          [
            ...(opts.customConnectors
              ? typeof opts.customConnectors === "function"
                ? opts.customConnectors(chains)
                : opts.customConnectors ?? []
              : opts.externalProviders
                ? [externalProviderConnector(opts.externalProviders)]
                : isLedgerDappBrowserProvider()
                  ? [
                      ledgerLiveConnector({
                        queryParams,
                        enabledChainsMap: {
                          evm: evmConfig.evmChainsMap,
                          cosmos: cosmosConfig.cosmosChainsMap,
                          misc: miscConfig.miscChainsMap,
                          substrate: substrateConfig.substrateChainsMap,
                        },
                      }),
                    ]
                  : Maybe.catMaybes([
                      evmConfig.connector,
                      cosmosConfig.connector,
                      ...miscConfig.connectors,
                    ])),
          ],
          {
            appName: config.appName,
            appIcon: config.appIcon,
            projectId: config.walletConnectV2.projectId,
          }
        ),
      });

      return Promise.resolve({
        evmConfig,
        cosmosConfig,
        miscConfig,
        substrateConfig,
        wagmiConfig,
      });
    },
    Left: (l) => {
      console.log(l);
      return Promise.reject(l);
    },
  });
};

const queryKey = [config.appPrefix, "wagmi-config"];
const staleTime = Infinity;

export const useWagmiConfig = (): UseQueryResult<
  Awaited<ReturnType<BuildWagmiConfig>>,
  Error
> => {
  const { wagmi, externalProviders } = useSettings();

  const queryClient = useSKQueryClient();

  return useQuery({
    staleTime,
    queryKey,
    queryFn: () =>
      buildWagmiConfig({
        forceWalletConnectOnly: !!wagmi?.forceWalletConnectOnly,
        customConnectors: wagmi?.__customConnectors__,
        externalProviders,
        queryClient,
        isLedgerLive: isLedgerDappBrowserProvider(),
      }),
  });
};

export const defaultConfig: ReturnType<typeof createConfig> = (() => {
  return createConfig({
    chains: [mainnet],
    client: ({ chain }) =>
      createClient({
        chain,
        transport: http(chain.rpcUrls.default.http.find((url) => !!url)),
      }),
  }) as ReturnType<typeof createConfig>;
})();
