import type { Connection } from "@solana/web3.js";
import type {
  Chain as RainbowkitChain,
  Wallet,
  WalletList,
} from "@stakekit/rainbowkit";
import { connectorsForWallets } from "@stakekit/rainbowkit";
import { Effect, FiberSet } from "effect";
import uniqwith from "lodash.uniqwith";
import { createStore, type Store as MipdStore } from "mipd";
import { createClient } from "viem";
import { type Connector, createConfig, http } from "wagmi";
import type { Chain } from "wagmi/chains";
import type { WalletAddress } from "../../../../domain/identity/identifiers";
import type { Network } from "../../../../domain/network/network";
import type { EnabledNetworks } from "../../../../domain/wallet/models";
import type { ExternalProviderSnapshot } from "../../../../public-api/external-provider-contract";
import type { SettingsProps, VariantProps } from "../../../../public-api/types";
import type { InitParams } from "../../../../services/wallet/init-params";
import { evmChainGroup } from "../../../../services/wallet/supported-chains";
import { config } from "../../../../shared/config/widget-defaults";
import { omitEnsUniversalResolver } from "../../default-wagmi-config";
import type { CurrentRef } from "../../external-provider";
import { WalletIntegrationError } from "../../wallet-errors";
import { getConfig as getMiscConfig } from "../adapters/config";
import type { MiscChainsMap } from "../adapters/configured-chains";
import type { CosmosChainsMap } from "../adapters/cosmos/chains";
import { getConfig as getCosmosConfig } from "../adapters/cosmos/config";
import type { EvmChainsMap } from "../adapters/evm/chains";
import { getConfig as getEvmConfig } from "../adapters/evm/config";
import { externalProviderConnector } from "../adapters/external-provider";
import { getConfig as getLedgerLiveConfig } from "../adapters/ledger/config";
import { getConfig as getSafeConnector } from "../adapters/safe/config";
import type { SubstrateChainsMap } from "../adapters/substrate/chains";
import { getConfig as getSubstrateConfig } from "../adapters/substrate/config";
import { buildsEcosystemConnectors } from "./connector-mode";
import type { RunWalletEffect } from "./effect-runner";
import { getVariantNetworkUrl } from "./network-icon";
import type { SolanaWalletDescriptor } from "./solana-runtime";
import type { makeWagmiActions } from "./wagmi-actions";

type MipdProviders = ReturnType<MipdStore["getProviders"]>;

export const getUnseenMipdProviders = ({
  connectors,
  providers,
}: {
  readonly connectors: ReadonlyArray<Pick<Connector, "id">>;
  readonly providers: MipdProviders;
}) => {
  const existingIds = new Set(connectors.map((connector) => connector.id));

  return uniqwith(
    providers,
    (first, second) => first.info.rdns === second.info.rdns
  ).filter((provider) => !existingIds.has(provider.info.rdns));
};

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
  externalProviders?: CurrentRef<ExternalProviderSnapshot>;
  enabledNetworks: EnabledNetworks;
  forceWalletConnectOnly: boolean;
  customConnectors?: (chains: Chain[]) => WalletList;
  isLedgerLive: boolean;
  isSafe: boolean;
  chainIconMapping: SettingsProps["chainIconMapping"];
  institutionalWallets: boolean;
  variant: VariantProps["variant"];
  solanaWallets: ReadonlyArray<SolanaWalletDescriptor>;
  solanaConnection: Connection;
  mapWalletListFn?: (val: WalletList) => WalletList;
  persistPublicKey: (input: {
    readonly address: WalletAddress;
    readonly publicKey: string;
  }) => Effect.Effect<void, unknown>;
  queryParams: InitParams;
  tonConnectManifestUrl: string | undefined;
};

const recoverEcosystemAdapter = <A>(
  ecosystem: "cosmos" | "misc" | "substrate",
  effect: Effect.Effect<A, WalletIntegrationError>
) =>
  effect.pipe(
    Effect.catch((cause) =>
      Effect.logError("Ecosystem wallet adapter failed").pipe(
        Effect.annotateLogs({
          cause,
          ecosystem,
          event: "ecosystem_wallet_adapter_failed",
        }),
        Effect.as(null)
      )
    )
  );

export const buildWagmiConfig = (
  opts: BuildWagmiConfigOptions,
  buildActions: Effect.Success<typeof makeWagmiActions>
) =>
  Effect.gen(function* () {
    const runWalletEffect: RunWalletEffect =
      yield* FiberSet.makeRuntimePromise();

    const buildConnectors = buildsEcosystemConnectors({
      hasCustomConnectors: !!opts.customConnectors,
      hasExternalProviders: !!opts.externalProviders,
      institutionalWallets: opts.institutionalWallets,
      isLedgerDappBrowser: opts.isLedgerLive,
      isSafe: opts.isSafe,
      variant: opts.variant,
    });
    const [evmConfig, cosmosConfig, miscConfig, substrateConfig] =
      yield* Effect.all(
        [
          getEvmConfig({
            enabledNetworks: opts.enabledNetworks,
            forceWalletConnectOnly: opts.forceWalletConnectOnly,
            institutionalWallets: opts.institutionalWallets,
            variant: opts.variant,
          }),
          recoverEcosystemAdapter(
            "cosmos",
            getCosmosConfig({
              buildConnectors,
              enabledNetworks: opts.enabledNetworks,
              forceWalletConnectOnly: opts.forceWalletConnectOnly,
              persistPublicKey: (input) =>
                runWalletEffect(opts.persistPublicKey(input)),
            })
          ),
          recoverEcosystemAdapter(
            "misc",
            getMiscConfig({
              buildConnectors,
              enabledNetworks: opts.enabledNetworks,
              forceWalletConnectOnly: opts.forceWalletConnectOnly,
              solanaWallets: opts.solanaWallets,
              solanaConnection: opts.solanaConnection,
              variant: opts.variant,
              tonConnectManifestUrl: opts.tonConnectManifestUrl,
            })
          ),
          recoverEcosystemAdapter(
            "substrate",
            getSubstrateConfig({
              buildConnectors,
              enabledNetworks: opts.enabledNetworks,
              forceWalletConnectOnly: opts.forceWalletConnectOnly,
            })
          ),
        ] as const,
        { concurrency: "unbounded" }
      );
    const cosmos = cosmosConfig ?? {
      cosmosChainsMap: {},
      cosmosWagmiChains: [],
      connector: null,
    };
    const misc = miscConfig ?? {
      miscChainsMap: {},
      miscChains: [],
      connectors: [null, null, null, null],
    };
    const substrate = substrateConfig ?? {
      substrateChainsMap: {},
      substrateChains: [],
      connector: null,
    };
    const ledgerLiveConnector = yield* getLedgerLiveConfig({
      enabledChainsMap: {
        evm: evmConfig.evmChainsMap,
        cosmos: cosmos.cosmosChainsMap,
        misc: misc.miscChainsMap,
        substrate: substrate.substrateChainsMap,
      },
      isLedgerDappBrowser: opts.isLedgerLive,
      queryParams: opts.queryParams,
      runWalletEffect,
    });
    const safeConnector = yield* opts.isSafe
      ? getSafeConnector()
      : Effect.succeed(null);
    const val = {
      enabledNetworks: opts.enabledNetworks,
      evmConfig,
      isLedgerLive: opts.isLedgerLive,
      cosmosConfig: cosmos,
      miscConfig: misc,
      substrateConfig: substrate,
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
            ...cosmos.cosmosChainsMap,
            ...misc.miscChainsMap,
            ...substrate.substrateChainsMap,
          }).map(mapWagmiChain) as [RainbowkitChain, ...RainbowkitChain[]];
        })()
      : (() => {
          return [
            ...evmConfig.evmChains,
            ...cosmos.cosmosWagmiChains,
            ...misc.miscChains,
            ...substrate.substrateChains,
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
    const solanaConnectorMode =
      !!val.miscConfig.miscChainsMap.solana &&
      !opts.externalProviders &&
      !val.safeConnector &&
      !ledgerLiveConnector &&
      !opts.customConnectors &&
      !opts.forceWalletConnectOnly;

    const customizeWalletList = (input: WalletList): WalletList => {
      let customized = input.map((group): WalletList[number] => ({
        ...group,
        wallets: group.wallets.map((createWalletFn) => (createWalletParams) => {
          const wallet = createWalletFn(createWalletParams);

          return opts.mapWalletFn
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
        }),
      }));
      customized = opts.mapWalletListFn?.(customized) ?? customized;
      customized = withoutEmptyWalletGroups(customized);

      return customized.map((group) => ({
        ...group,
        wallets: group.wallets.map(
          (createWalletFn): typeof createWalletFn =>
            (details) => {
              const wallet = createWalletFn(details);

              return {
                ...wallet,
                createConnector: (walletDetails) => (connectorConfig) =>
                  wallet.createConnector(walletDetails)({
                    ...connectorConfig,
                    chains:
                      wallet.chainGroup.id === evmChainGroup.id
                        ? (evmConfig.evmChains as [Chain, ...Chain[]])
                        : connectorConfig.chains,
                  }),
              };
            }
        ),
      }));
    };

    const connectorOptions = {
      appName: config.appName,
      appIcon: config.appIcon,
      projectId: config.walletConnectV2.projectId,
    } as const;

    const rawWalletList: WalletList = (() => {
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
          ...misc.connectors.filter((value) => value !== null),
        ];
      }

      if (opts.externalProviders) {
        return [
          externalProviderConnector(opts.externalProviders, runWalletEffect),
        ];
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
        cosmos.connector,
        substrate.connector,
        ...misc.connectors,
      ]
        .filter((value): value is WalletList[number] => value !== null)
        .filter((value) => value.wallets.length > 0);
    })();
    const walletList = customizeWalletList(rawWalletList);

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
      // The host owns external-provider connection state. Hydrating Wagmi's
      // persisted connector can restore a connector from another topology
      // before the external provider synchronizer establishes its connection.
      storage: opts.externalProviders ? null : undefined,
      connectors: connectorsForWallets(walletList, connectorOptions),
    });

    if (multiInjectedProviderDiscovery && evmConfig.evmChains.length > 0) {
      const mipdStore = createStore();

      yield* scopedMipdSubscription({
        initialProviders: mipdStore.getProviders(),
        publish: (providers) => {
          wagmiConfig._internal.connectors.setState((prev) => {
            const unseenProviders = getUnseenMipdProviders({
              connectors: prev,
              providers,
            });

            return [
              ...prev,
              ...unseenProviders.map((provider) => ({
                rkDetails: { chainGroup: evmChainGroup },
                ...wagmiConfig._internal.connectors.setup(
                  wagmiConfig._internal.connectors.providerDetailToConnector(
                    provider
                  )
                ),
              })),
            ];
          });
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

    const actions = buildActions({ config: wagmiConfig });
    const createSolanaConnector = Effect.fn("createSolanaConnector")(function* (
      wallet: SolanaWalletDescriptor
    ) {
      const { getSolanaConnectors } = yield* Effect.promise(
        () => import("../adapters/solana/solana-connector")
      );
      const solanaGroup = getSolanaConnectors({
        connection: opts.solanaConnection,
        forceWalletConnectOnly: opts.forceWalletConnectOnly,
        variant: opts.variant,
        wallets: [wallet],
      });
      const hasSolanaGroup = rawWalletList.some(
        (group) => group.groupName === solanaGroup.groupName
      );
      const dynamicWalletList = customizeWalletList(
        hasSolanaGroup
          ? rawWalletList.map((group) =>
              group.groupName === solanaGroup.groupName ? solanaGroup : group
            )
          : [...rawWalletList, solanaGroup]
      ).filter((group) => group.groupName === solanaGroup.groupName);
      const connector = connectorsForWallets(
        dynamicWalletList,
        connectorOptions
      )[0];
      if (!connector) {
        return yield* Effect.fail(
          new WalletIntegrationError({
            message: `Solana wallet ${wallet.adapter.name} was filtered`,
            operation: "create-solana-connector",
          })
        );
      }
      return connector;
    });

    return {
      ...val,
      actions,
      createSolanaConnector,
      solanaConnectorMode,
      wagmiConfig,
      queryParamsInitChainId,
    };
  });

export type WalletController = Effect.Success<
  ReturnType<typeof buildWagmiConfig>
>;
