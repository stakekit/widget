import { useAtomValue } from "@effect/atom-react";
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
import { Data, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import uniqwith from "lodash.uniqwith";
import { createStore } from "mipd";
import { EitherAsync, Just, Left, Maybe, Right } from "purify-ts";
import type { RefObject } from "react";
import { createClient } from "viem";
import type { Connector } from "wagmi";
import { createConfig, http } from "wagmi";
import { connect, reconnect, switchChain } from "wagmi/actions";
import type { Chain } from "wagmi/chains";
import { mainnet } from "wagmi/chains";
import { getVariantNetworkUrl } from "../../components/atoms/token-icon/token-icon-container/hooks/use-variant-network-urls";
import { config } from "../../config";
import type {
  EnabledNetworks,
  WalletInitParams,
} from "../../domain/schema/wallet-models";
import { evmChainGroup } from "../../domain/types/chains";
import type { CosmosChainsMap } from "../../domain/types/chains/cosmos";
import type { EvmChainsMap } from "../../domain/types/chains/evm";
import type { MiscChainsMap } from "../../domain/types/chains/misc";
import type { Networks } from "../../domain/types/chains/networks";
import type { SubstrateChainsMap } from "../../domain/types/chains/substrate";
import type { SKExternalProviders } from "../../domain/types/wallets";
import { useSavedRef } from "../../hooks/use-saved-ref";
import type { GetEitherAsyncRight } from "../../types/utils";
import { isLedgerDappBrowserProvider, isMobile } from "../../utils";
import { getConfig as getCosmosConfig } from "../cosmos/config";
import { getConfig as getEvmConfig } from "../ethereum/config";
import { externalProviderConnector } from "../external-provider";
import { getConfig as getLedgerLiveConfig } from "../ledger/config";
import { getConfig as getMiscConfig } from "../misc/config";
import { getConfig as getSafeConnector } from "../safe/config";
import { configMeta as safeConfigMeta } from "../safe/safe-connector-meta";
import { useSettings } from "../settings";
import type { SettingsProps, VariantProps } from "../settings/types";
import { getConfig as getSubstrateConfig } from "../substrate/config";
import {
  enabledNetworksAtom,
  WalletInitParamsKey,
  walletInitParamsAtom,
} from "./atoms";

const mipdStore = createStore();

const omitEnsUniversalResolver = <T extends RainbowkitChain>(chain: T): T => {
  if (!chain.contracts?.ensUniversalResolver) return chain;

  const { ensUniversalResolver: _ensUniversalResolver, ...contracts } =
    chain.contracts;

  // RainbowKit resolves ENS profiles whenever mainnet exposes this contract.
  // We do not render ENS data, and viem's default mainnet RPC is eth.merkle.io.
  return { ...chain, contracts } as T;
};

const withoutEmptyWalletGroups = (walletList: WalletList): WalletList =>
  walletList.filter((walletGroup) => walletGroup.wallets.length > 0);

type BuildWagmiConfigOptions = {
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
  queryParams: WalletInitParams;
  tonConnectManifestUrl: string | undefined;
};

const buildWagmiConfig = async (
  opts: BuildWagmiConfigOptions
): Promise<{
  evmConfig: GetEitherAsyncRight<ReturnType<typeof getEvmConfig>>;
  cosmosConfig: GetEitherAsyncRight<ReturnType<typeof getCosmosConfig>>;
  miscConfig: GetEitherAsyncRight<ReturnType<typeof getMiscConfig>>;
  substrateConfig: GetEitherAsyncRight<ReturnType<typeof getSubstrateConfig>>;
  wagmiConfig: ReturnType<typeof createConfig>;
  queryParamsInitChainId: number | undefined;
  cleanup: () => void;
}> => {
  return EitherAsync.fromPromise(() =>
    Promise.all([
      getEvmConfig({
        enabledNetworks: opts.enabledNetworks,
        forceWalletConnectOnly: opts.forceWalletConnectOnly,
        institutionalWallets: opts.institutionalWallets,
        variant: opts.variant,
      }),
      getCosmosConfig({
        enabledNetworks: opts.enabledNetworks,
        forceWalletConnectOnly: opts.forceWalletConnectOnly,
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
    ]).then(([evm, cosmos, misc, substrate]) =>
      evm.chain((e) =>
        cosmos.chain((c) =>
          misc.chain((m) =>
            substrate.map((s) => ({
              evmConfig: e,
              cosmosConfig: c,
              miscConfig: m,
              substrateConfig: s,
              queryParams: opts.queryParams,
            }))
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
        queryParams: val.queryParams,
      }).map((l) => ({ ...val, ledgerLiveConnector: l }))
    )
    .chain((val) =>
      EitherAsync.liftEither(Maybe.fromFalsy(opts.isSafe).toEither(null))
        .chain(() => getSafeConnector())
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
        .map(withoutEmptyWalletGroups)
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

      let cleanup = () => {};

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

        cleanup = mipdStore.subscribe((providers) => {
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
        cleanup,
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

class WalletInitializationError extends Data.TaggedError(
  "WalletInitializationError"
)<{
  readonly cause: unknown;
  readonly phase: "configuration";
}> {}

type WalletInitializationKeyFields = Omit<
  BuildWagmiConfigOptions,
  "enabledNetworks" | "queryParams"
> & {
  readonly externalProvidersValue: SKExternalProviders | undefined;
};

export class WalletInitializationKey extends Data.Class<WalletInitializationKeyFields> {}

export const withWalletLifecycleCleanup = <
  A extends { readonly cleanup: () => void },
  E,
  R,
>(
  effect: Effect.Effect<A, E, R>
) =>
  Effect.gen(function* () {
    const result = yield* effect;
    yield* Effect.addFinalizer(() => Effect.sync(result.cleanup));
    return result;
  });

export type WalletInitializationOperations = {
  readonly connect: (
    config: ReturnType<typeof createConfig>,
    options: {
      readonly chainId: number | undefined;
      readonly connector: Connector;
    }
  ) => Promise<unknown>;
  readonly isLedgerLive: () => boolean;
  readonly isMobile: () => boolean;
  readonly reconnect: (
    config: ReturnType<typeof createConfig>
  ) => Promise<ReadonlyArray<unknown>>;
  readonly switchChain: (
    config: ReturnType<typeof createConfig>,
    options: { readonly chainId: number }
  ) => Promise<unknown>;
};

const walletInitializationOperations: WalletInitializationOperations = {
  connect: (config, options) => connect(config, options),
  isLedgerLive: isLedgerDappBrowserProvider,
  isMobile,
  reconnect: (config) => reconnect(config),
  switchChain: (config, options) => switchChain(config, options),
};

export const initializeWallet = ({
  externalProviders,
  operations = walletInitializationOperations,
  queryParamsInitChainId,
  wagmiConfig,
}: {
  readonly externalProviders: SKExternalProviders | undefined;
  readonly operations?: WalletInitializationOperations;
  readonly queryParamsInitChainId: number | undefined;
  readonly wagmiConfig: ReturnType<typeof createConfig>;
}) =>
  Effect.gen(function* () {
    const reconnected = yield* Effect.tryPromise(() =>
      operations.reconnect(wagmiConfig)
    ).pipe(Effect.orElseSucceed(() => []));

    if (
      !externalProviders &&
      reconnected.length === 0 &&
      !operations.isLedgerLive() &&
      operations.isMobile()
    ) {
      const injectedConnector = wagmiConfig.connectors.find(
        (connector: Connector) =>
          connector.id === "injected" || connector.id === safeConfigMeta.id
      );

      if (injectedConnector) {
        yield* Effect.tryPromise(() =>
          operations.connect(wagmiConfig, {
            connector: injectedConnector,
            chainId: queryParamsInitChainId,
          })
        ).pipe(Effect.ignore);
      }
    }

    if (
      queryParamsInitChainId &&
      wagmiConfig.state.chainId !== queryParamsInitChainId
    ) {
      yield* Effect.tryPromise(() =>
        operations.switchChain(wagmiConfig, {
          chainId: queryParamsInitChainId,
        })
      ).pipe(Effect.ignore);
    }
  });

export const walletInitializationAtom = (key: WalletInitializationKey) =>
  walletInitializationAtomFamily(key);

const walletInitializationAtomFamily = Atom.family(
  (key: WalletInitializationKey) =>
    Atom.make((get) =>
      Effect.gen(function* () {
        const enabledNetworks = yield* get.result(enabledNetworksAtom);
        const queryParams = yield* get.result(
          walletInitParamsAtom(
            new WalletInitParamsKey({
              externalProviderInitToken:
                key.externalProvidersValue?.initToken ?? null,
            })
          )
        );
        const result = yield* withWalletLifecycleCleanup(
          Effect.tryPromise({
            try: () =>
              buildWagmiConfig({
                ...key,
                enabledNetworks,
                queryParams,
              }),
            catch: (cause) =>
              new WalletInitializationError({
                cause,
                phase: "configuration",
              }),
          })
        );
        yield* initializeWallet({
          externalProviders: key.externalProvidersValue,
          queryParamsInitChainId: result.queryParamsInitChainId,
          wagmiConfig: result.wagmiConfig,
        });

        return result;
      })
    ).pipe(Atom.setIdleTTL(0))
);

type WagmiConfigResult = {
  readonly data: Awaited<ReturnType<typeof buildWagmiConfig>> | undefined;
  readonly error: unknown;
  readonly isLoading: boolean;
};

export const useWagmiConfig = (): WagmiConfigResult => {
  const {
    wagmi,
    externalProviders,
    isSafe,
    disableInjectedProviderDiscovery,
    mapWalletFn,
    chainIconMapping,
    institutionalWallets,
    variant,
    mapWalletListFn,
    tonConnectManifestUrl,
  } = useSettings();
  const solanaWallets = useSolanaWallet();
  const solanaConnection = useSolanaConnection();

  const externalProvidersRef = useSavedRef(externalProviders) as
    | RefObject<SKExternalProviders>
    | RefObject<undefined>;

  const result = useAtomValue(
    walletInitializationAtom(
      new WalletInitializationKey({
        mapWalletFn,
        disableInjectedProviderDiscovery: !!disableInjectedProviderDiscovery,
        forceWalletConnectOnly: !!wagmi?.forceWalletConnectOnly,
        customConnectors: wagmi?.__customConnectors__,
        isLedgerLive: isLedgerDappBrowserProvider(),
        isSafe: !!isSafe,
        ...(externalProvidersRef.current && {
          externalProviders: externalProvidersRef,
        }),
        externalProvidersValue: externalProviders,
        chainIconMapping,
        institutionalWallets: !!institutionalWallets,
        variant,
        solanaWallets: solanaWallets.wallets,
        solanaConnection: solanaConnection.connection,
        mapWalletListFn,
        tonConnectManifestUrl,
      })
    )
  );

  return {
    data: result.pipe(AsyncResult.value, Option.getOrUndefined),
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: AsyncResult.isInitial(result),
  };
};

export const defaultConfig = createConfig({
  chains: [omitEnsUniversalResolver(mainnet)],
  client: ({ chain }) =>
    createClient({
      chain,
      transport: http(chain.rpcUrls.default.http.find((url) => !!url)),
    }),
});
