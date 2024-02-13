import { Chain, configureChains, createConfig, mainnet } from "wagmi";
import { publicProvider } from "wagmi/providers/public";
import { getConfig as getEvmConfig } from "../ethereum/config";
import { getConfig as getCosmosConfig } from "../cosmos/config";
import { getConfig as getMiscConfig } from "../misc/config";
import { getConfig as getSubstrateConfig } from "../substrate/config";
import { WalletList, connectorsForWallets } from "@stakekit/rainbowkit";
import { ledgerLiveConnector } from "../ledger/ledger-connector";
import { config } from "../../config";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";
import { useSettings } from "../settings";
import { GetEitherAsyncRight } from "../../types";
import { isLedgerDappBrowserProvider } from "../../utils";

export type BuildWagmiConfig = typeof buildWagmiConfig;

const buildWagmiConfig = async (opts: {
  forceWalletConnectOnly: boolean;
  customConnectors?: (chains: Chain[]) => WalletList;
}): Promise<{
  evmConfig: GetEitherAsyncRight<ReturnType<typeof getEvmConfig>>;
  cosmosConfig: GetEitherAsyncRight<ReturnType<typeof getCosmosConfig>>;
  miscConfig: GetEitherAsyncRight<ReturnType<typeof getMiscConfig>>;
  substrateConfig: GetEitherAsyncRight<ReturnType<typeof getSubstrateConfig>>;
  chains: Chain[];
  wagmiConfig: ReturnType<typeof createConfig>;
}> => {
  return EitherAsync.fromPromise(() =>
    Promise.all([
      getEvmConfig({ forceWalletConnectOnly: opts.forceWalletConnectOnly }),
      getCosmosConfig({ forceWalletConnectOnly: opts.forceWalletConnectOnly }),
      getMiscConfig(),
      getSubstrateConfig(),
    ]).then(([evm, cosmos, misc, substrate]) =>
      evm.chain((e) =>
        cosmos.chain((c) =>
          misc.chain((m) =>
            substrate.map((s) => ({
              evmConfig: e,
              cosmosConfig: c,
              miscConfig: m,
              substrateConfig: s,
            }))
          )
        )
      )
    )
  ).caseOf({
    Right: ({ evmConfig, cosmosConfig, miscConfig, substrateConfig }) => {
      const { chains, publicClient, webSocketPublicClient } = configureChains(
        [
          ...evmConfig.evmChains,
          ...cosmosConfig.cosmosWagmiChains,
          ...miscConfig.miscChains,
          ...substrateConfig.substrateChains,
        ],
        [publicProvider()]
      );

      const wagmiConfig = createConfig({
        autoConnect: true,
        connectors: connectorsForWallets([
          ...(isLedgerDappBrowserProvider()
            ? [
                ledgerLiveConnector({
                  evm: evmConfig.evmChainsMap,
                  cosmos: cosmosConfig.cosmosChainsMap,
                  misc: miscConfig.miscChainsMap,
                  substrate: substrateConfig.substrateChainsMap,
                }),
              ]
            : Maybe.catMaybes([
                evmConfig.connector,
                cosmosConfig.connector,
                ...miscConfig.connectors,
              ])),
          ...(typeof opts.customConnectors === "function"
            ? opts.customConnectors(chains)
            : opts.customConnectors ?? []),
        ]),
        publicClient,
        webSocketPublicClient,
      }) as ReturnType<typeof createConfig>;

      return Promise.resolve({
        evmConfig,
        cosmosConfig,
        miscConfig,
        substrateConfig,
        chains,
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
  const { wagmi } = useSettings();

  return useQuery({
    staleTime,
    queryKey,
    queryFn: () =>
      buildWagmiConfig({
        forceWalletConnectOnly: !!wagmi?.forceWalletConnectOnly,
        customConnectors: wagmi?.__customConnectors__,
      }),
  });
};

export const defaultConfig: ReturnType<typeof createConfig> = (() => {
  const { publicClient, webSocketPublicClient } = configureChains(
    [mainnet], // must use at least one chain
    [publicProvider()]
  );

  return createConfig({
    autoConnect: true,
    publicClient,
    webSocketPublicClient,
    connectors: [],
  }) as ReturnType<typeof createConfig>;
})();
