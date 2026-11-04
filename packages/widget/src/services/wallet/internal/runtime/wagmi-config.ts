import type { Connection } from "@solana/web3.js";
import { Array as EArray, Effect, FiberSet, Struct } from "effect";
import { createStore, type Store as MipdStore } from "mipd";
import { createClient } from "viem";
import { type Connector, createConfig, http } from "wagmi";
import { type Chain, mainnet } from "wagmi/chains";
import type { Network } from "../../../../domain/network/network";
import type { EnabledWalletNetworks } from "../../../../domain/wallet/models";
import type { WalletNetwork } from "../../../../domain/wallet/network";
import {
  applyWalletPolicy,
  type WalletPolicy,
} from "../../../../domain/wallet/wallet-policy";
import { evmChainGroup } from "../../../../services/wallet/evm-chain-group";
import type { InitParams } from "../../../../services/wallet/init-params";
import { config } from "../../../../shared/config/widget-defaults";
import type { ExternalProviderSnapshot } from "../../../config/external-provider-snapshot";
import type { HostProfile } from "../../../config/host-profile";
import type { WidgetConfig } from "../../../config/widget-config-model";
import type { WidgetPersistence } from "../../../persistence/widget-persistence";
import { omitEnsUniversalResolver } from "../../default-wagmi-config";
import type { CurrentRef } from "../../external-provider";
import {
  connectorsForWallets,
  type Chain as WalletChain,
  type WalletDescriptor,
  type WalletList,
} from "../../wallet-descriptors";
import { WalletIntegrationError } from "../../wallet-errors";
import type { WalletModal } from "../../wallet-modal";
import { getConfig as getMiscConfig } from "../adapters/config";
import { getConfig as getCosmosConfig } from "../adapters/cosmos/config";
import { getConfig as getEvmConfig } from "../adapters/evm/config";
import { announcedWalletAvailability } from "../adapters/evm/injected-availability";
import { externalProviderConnector } from "../adapters/external-provider";
import { getConfig as getLedgerLiveConfig } from "../adapters/ledger/config";
import { getConfig as getSafeConnector } from "../adapters/safe/config";
import { getConfig as getSubstrateConfig } from "../adapters/substrate/config";
import type { StellarWalletsKitPlatformService } from "../platform/stellar-wallets-kit-platform";
import type { WalletConnectPresentationPlatform } from "../platform/wallet-connect-presentation";
import type { WalletConnectProtocolPlatform } from "../platform/wallet-connect-protocol";
import { buildsEcosystemConnectors } from "./connector-mode";
import type { RunWalletEffect } from "./effect-runner";
import { getVariantNetworkUrl } from "./network-icon";
import type { SolanaWalletDescriptor } from "./solana-runtime";
import type { makeWagmiActions } from "./wagmi-actions";

type MipdProviders = ReturnType<MipdStore["getProviders"]>;

export const getUnseenMipdProviders = ({
  connectors,
  providers,
  walletPolicy = {},
}: {
  readonly connectors: ReadonlyArray<Pick<Connector, "id">>;
  readonly providers: MipdProviders;
  readonly walletPolicy?: WalletPolicy;
}) => {
  const existingIds = new Set(connectors.map((connector) => connector.id));

  const unseen = EArray.dedupeWith(
    providers,
    (first, second) => first.info.rdns === second.info.rdns
  ).filter((provider) => !existingIds.has(provider.info.rdns));

  return applyWalletPolicy(
    [
      {
        groupName: "Injected",
        wallets: unseen.map((provider) => ({
          id: provider.info.rdns,
          provider,
        })),
      },
    ],
    walletPolicy
  ).flatMap((group) => group.wallets.map(({ provider }) => provider));
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

// Built from the wallet config snapshot, which carries unset settings as
// `undefined`.
export type BuildWagmiConfigOptions = {
  disableInjectedProviderDiscovery: boolean;
  mapWalletFn?: WidgetConfig["mapWalletFn"];
  externalProviders?: CurrentRef<ExternalProviderSnapshot> | undefined;
  enabledNetworks: EnabledWalletNetworks;
  walletListFactory?: ((chains: Chain[]) => WalletList) | undefined;
  isLedgerLive: boolean;
  isSafe: boolean;
  chainIconMapping: WidgetConfig["chainIconMapping"];
  institutionalWallets: boolean;
  walletCatalogue: HostProfile["walletCatalogue"];
  solanaWallets: ReadonlyArray<SolanaWalletDescriptor>;
  solanaConnection: Connection;
  walletPolicy?: WalletPolicy | undefined;
  persistPublicKey: WidgetPersistence["Service"]["upsertStoredPublicKey"];
  queryParams: InitParams;
  tonConnectManifestUrl: string | undefined;
};

const recoverEcosystemAdapter = <A, R>(
  ecosystem: "cosmos" | "misc" | "substrate",
  effect: Effect.Effect<A, WalletIntegrationError, R>
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
  buildActions: Effect.Success<typeof makeWagmiActions>,
  stellarWalletsKitPlatform: StellarWalletsKitPlatformService,
  walletConnectPresentationPlatform: WalletConnectPresentationPlatform["Service"],
  walletConnectProtocolPlatform: WalletConnectProtocolPlatform["Service"],
  walletModal: WalletModal["Service"]
) =>
  Effect.gen(function* () {
    const runWalletEffect: RunWalletEffect =
      yield* FiberSet.makeRuntimePromise();
    const walletConnectPresentation =
      yield* walletConnectPresentationPlatform.make;
    const walletConnectProtocol = yield* walletConnectProtocolPlatform.make;

    const buildConnectors = buildsEcosystemConnectors({
      hasCustomWalletList: !!opts.walletListFactory,
      hasExternalProviders: !!opts.externalProviders,
      institutionalWallets: opts.institutionalWallets,
      isLedgerDappBrowser: opts.isLedgerLive,
      isSafe: opts.isSafe,
    });
    const [evmConfig, cosmosConfig, miscConfig, substrateConfig] =
      yield* Effect.all(
        [
          getEvmConfig({
            enabledNetworks: opts.enabledNetworks,
            institutionalWallets: opts.institutionalWallets,
            walletCatalogue: opts.walletCatalogue,
            walletConnectPresentation,
            runWalletEffect,
          }),
          recoverEcosystemAdapter(
            "cosmos",
            getCosmosConfig({
              buildConnectors,
              enabledNetworks: opts.enabledNetworks,
              walletConnectProtocol,
              runWalletEffect,
              persistPublicKey: (input) =>
                runWalletEffect(opts.persistPublicKey(input)),
            })
          ),
          recoverEcosystemAdapter(
            "misc",
            getMiscConfig({
              buildConnectors,
              enabledNetworks: opts.enabledNetworks,
              stellarWalletsKitPlatform,
              runWalletEffect,
              walletConnectProtocol,
              solanaWallets: opts.solanaWallets,
              solanaConnection: opts.solanaConnection,
              walletCatalogue: opts.walletCatalogue,
              tonConnectManifestUrl: opts.tonConnectManifestUrl,
              walletModal,
            })
          ),
          recoverEcosystemAdapter(
            "substrate",
            getSubstrateConfig({
              buildConnectors,
              enabledNetworks: opts.enabledNetworks,
              walletConnectProtocol,
              runWalletEffect,
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
      connectors: [null, null, null, null, null],
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
      ? getSafeConnector
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
    const configuredChainsMap: Partial<
      Record<
        WalletNetwork,
        { readonly network: WalletNetwork; readonly wagmiChain: WalletChain }
      >
    > = {
      ...evmConfig.evmChainsMap,
      ...cosmos.cosmosChainsMap,
      ...misc.miscChainsMap,
      ...substrate.substrateChainsMap,
    };

    const chains: WalletChain[] = opts.chainIconMapping
      ? (() => {
          const chainIconMapping = opts.chainIconMapping;
          const mapWagmiChain = (val: {
            wagmiChain: WalletChain;
            network: Network;
          }): WalletChain => {
            const res = getVariantNetworkUrl({
              network: val.network,
              chainIconMapping,
            });

            if (res === val.wagmiChain.iconUrl) {
              return val.wagmiChain;
            }

            return {
              ...Struct.omit(val.wagmiChain, ["iconBackground"]),
              iconUrl: res,
            };
          };

          return Object.values(configuredChainsMap).map(mapWagmiChain);
        })()
      : [
          ...evmConfig.evmChains,
          ...cosmos.cosmosWagmiChains,
          ...misc.miscChains,
          ...substrate.substrateChains,
        ];

    const chainsWithoutEnsProfileLookups = chains.map(omitEnsUniversalResolver);
    const hasConfiguredWalletNetworks =
      chainsWithoutEnsProfileLookups.length > 0;
    const wagmiChains: [WalletChain, ...WalletChain[]] = EArray.isArrayNonEmpty(
      chainsWithoutEnsProfileLookups
    )
      ? chainsWithoutEnsProfileLookups
      : [omitEnsUniversalResolver(mainnet)];

    const multiInjectedProviderDiscovery =
      !opts.disableInjectedProviderDiscovery &&
      !opts.externalProviders &&
      !val.ledgerLiveConnector &&
      !val.safeConnector &&
      opts.walletCatalogue !== "porto";
    const solanaConnectorMode =
      !!val.miscConfig.miscChainsMap.solana &&
      !opts.externalProviders &&
      !val.safeConnector &&
      !ledgerLiveConnector &&
      !opts.walletListFactory;

    const connectorOptions = {
      appName: config.appName,
      appIcon: config.appIcon,
      projectId: config.walletConnectV2.projectId,
    } as const;

    const customizeWalletList = (input: WalletList): WalletList => {
      const available = input.map((group) => ({
        groupName: group.groupName,
        wallets: group.wallets.map((createWalletFn) => {
          const wallet = createWalletFn(connectorOptions);

          return { createWalletFn, id: wallet.id };
        }),
      }));
      const customized = applyWalletPolicy(available, opts.walletPolicy ?? {});

      return customized.map((group) => ({
        ...group,
        wallets: group.wallets.map(
          ({ createWalletFn }): WalletList[number]["wallets"][number] =>
            (walletDetails) => {
              const originalWallet = createWalletFn(walletDetails);
              const wallet = opts.mapWalletFn
                ? ({
                    ...originalWallet,
                    ...opts.mapWalletFn({
                      iconBackground: originalWallet.iconBackground,
                      iconUrl: originalWallet.iconUrl,
                      id: originalWallet.id,
                      name: originalWallet.name,
                    }),
                  } satisfies WalletDescriptor)
                : originalWallet;

              return {
                ...wallet,
                createConnector: (walletDetails) => (connectorConfig) =>
                  wallet.createConnector(walletDetails)({
                    ...connectorConfig,
                    chains:
                      wallet.chainGroup.id === evmChainGroup.id &&
                      EArray.isArrayNonEmpty(evmConfig.evmChains)
                        ? evmConfig.evmChains
                        : connectorConfig.chains,
                  }),
              };
            }
        ),
      }));
    };

    const rawWalletList: WalletList = (() => {
      if (!hasConfiguredWalletNetworks) return [];

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

      if (opts.walletListFactory) {
        return opts.walletListFactory(chains);
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
    const connectors =
      walletList.length > 0
        ? connectorsForWallets(walletList, connectorOptions)
        : [];

    const queryNetwork = val.queryParams.network;
    const queryParamsInitChainId = queryNetwork
      ? configuredChainsMap[queryNetwork]?.wagmiChain.id
      : undefined;

    const wagmiConfig = yield* Effect.try({
      try: () =>
        createConfig({
          // Wagmi requires one transport chain even when the project has no Wallet
          // Networks. The fallback is absent from every adapter map and connector,
          // so the exposed wallet topology remains empty.
          chains: wagmiChains,
          client: ({ chain }) => createClient({ chain, transport: http() }),
          multiInjectedProviderDiscovery: false,
          // The host owns external-provider connection state. Hydrating Wagmi's
          // persisted connector can restore a connector from another topology
          // before the external provider synchronizer establishes its connection.
          storage: opts.externalProviders ? null : undefined,
          connectors,
        }),
      catch: (cause) =>
        new WalletIntegrationError({
          cause,
          message: "Could not create wallet configuration",
          operation: "create-config",
        }),
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
              walletPolicy: opts.walletPolicy ?? {},
            });

            return [
              ...prev,
              ...unseenProviders.map((provider, index) => ({
                ...wagmiConfig._internal.connectors.setup(
                  wagmiConfig._internal.connectors.providerDetailToConnector(
                    provider
                  )
                ),
                walletDetails: {
                  availability: announcedWalletAvailability({
                    rdns: provider.info.rdns,
                    store: mipdStore,
                  }),
                  chainGroup: evmChainGroup,
                  groupIndex: 0,
                  groupName: "Installed",
                  iconBackground: "transparent",
                  iconUrl: provider.info.icon,
                  id: provider.info.rdns,
                  index,
                  name: provider.info.name,
                  rdns: provider.info.rdns,
                },
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
        walletCatalogue: opts.walletCatalogue,
        wallets: [wallet],
      });
      const dynamicWalletList = customizeWalletList([solanaGroup]);
      const connector = connectorsForWallets(
        dynamicWalletList,
        connectorOptions
      )[0];
      if (!connector) {
        return yield* new WalletIntegrationError({
          message: `Solana wallet ${wallet.adapter.name} was filtered`,
          operation: "create-solana-connector",
        });
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
