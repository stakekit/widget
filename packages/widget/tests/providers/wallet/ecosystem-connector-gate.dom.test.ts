import { describe, expect, it } from "@effect/vitest";
import type { Connection as SolanaConnection } from "@solana/web3.js";
import { Effect, Schema } from "effect";
import { vi } from "vitest";
import type { Network } from "../../../src/domain/network/network";
import type { SKExternalProviders } from "../../../src/public-api/types";
import type { CurrentRef } from "../../../src/services/wallet/external-provider";
import { InitParams } from "../../../src/services/wallet/init-params";
import { getConfig as getMiscConfig } from "../../../src/services/wallet/internal/adapters/config";
import { getConfig as getCosmosConfig } from "../../../src/services/wallet/internal/adapters/cosmos/config";
import { getConfig as getSubstrateConfig } from "../../../src/services/wallet/internal/adapters/substrate/config";
import {
  StellarWalletsKitPlatform,
  type StellarWalletsKitPlatformService,
} from "../../../src/services/wallet/internal/platform/stellar-wallets-kit-platform";
import { WagmiOperations } from "../../../src/services/wallet/internal/platform/wagmi-operations";
import { buildsEcosystemConnectors } from "../../../src/services/wallet/internal/runtime/connector-mode";
import { makeWagmiActions } from "../../../src/services/wallet/internal/runtime/wagmi-actions";
import {
  type BuildWagmiConfigOptions,
  buildWagmiConfig,
} from "../../../src/services/wallet/internal/runtime/wagmi-config";
import { WalletIntegrationError } from "../../../src/services/wallet/wallet-errors";
import { runWalletEffect } from "../../utils/run-wallet-effect";

const browser = vi.hoisted(() => ({ isLedgerDappBrowser: false }));

/**
 * Counts how often each connector chunk is evaluated. The gate exists so those
 * dynamic imports never happen, so the counters are the assertion that matters.
 */
const evaluated = vi.hoisted(() => ({
  cardanoConnector: 0,
  cosmosWalletManager: 0,
  failCosmosWalletManager: false,
  stellarConnectorCalls: 0,
  substrateConnector: 0,
  tonConnector: 0,
  tronConnector: 0,
}));

vi.mock(
  "../../../src/services/wallet/internal/adapters/stellar/stellar-connector",
  () => {
    return {
      getStellarConnectors: () => {
        evaluated.stellarConnectorCalls += 1;
        return {
          groupName: "Stellar",
          wallets: [],
        };
      },
    };
  }
);

vi.mock("../../../src/services/wallet/browser-environment", () => ({
  isLedgerDappBrowserProvider: () => browser.isLedgerDappBrowser,
  isMobileWalletEnvironment: () => false,
  isWalletIframe: () => true,
}));

vi.mock(
  "../../../src/services/wallet/internal/adapters/substrate/substrate-connector",
  () => {
    evaluated.substrateConnector += 1;

    return {
      getSubstrateConnectors: () =>
        Effect.succeed({ groupName: "Substrate", wallets: [] }),
    };
  }
);

vi.mock(
  "../../../src/services/wallet/internal/adapters/tron/tron-connector",
  () => {
    evaluated.tronConnector += 1;

    return { getTronConnectors: () => ({ groupName: "Tron", wallets: [] }) };
  }
);

vi.mock(
  "../../../src/services/wallet/internal/adapters/cardano/cardano-connector",
  () => {
    evaluated.cardanoConnector += 1;

    return {
      getCardanoConnectors: () => ({ groupName: "Cardano", wallets: [] }),
    };
  }
);

vi.mock(
  "../../../src/services/wallet/internal/adapters/ton/ton-connector",
  () => {
    evaluated.tonConnector += 1;

    return { getTonConnectors: () => ({ groupName: "TON", wallets: [] }) };
  }
);

vi.mock(
  "../../../src/services/wallet/internal/adapters/cosmos/wallet-manager",
  () => {
    evaluated.cosmosWalletManager += 1;

    return {
      getWalletManager: () => {
        if (evaluated.failCosmosWalletManager) {
          throw new TypeError(
            "Cannot read properties of undefined (reading 'Init')"
          );
        }

        return {
          connector: { groupName: "Cosmos", wallets: [] },
          walletManager: { onMounted: async () => undefined },
        };
      },
    };
  }
);

const cosmosNetworks = new Set<Network>(["cosmos"]);
const miscNetworks = new Set<Network>(["cardano", "ton", "tron"]);
const substrateNetworks = new Set<Network>(["polkadot"]);

type ConnectorModeInput = Parameters<typeof buildsEcosystemConnectors>[0];

const gateInput = (
  overrides: Partial<ConnectorModeInput> = {}
): ConnectorModeInput => ({
  hasCustomWalletList: false,
  hasExternalProviders: false,
  institutionalWallets: false,
  isLedgerDappBrowser: false,
  isSafe: false,
  variant: "default",
  ...overrides,
});

const emptyInitParams = {
  accountId: null,
  balanceId: null,
  network: null,
  pendingaction: null,
  tab: null,
  token: null,
  validator: null,
  yieldId: null,
} as const;

const externalProviders: CurrentRef<SKExternalProviders> = {
  current: {
    currentAddress: "0x0000000000000000000000000000000000000001",
    currentChain: 1,
    provider: {
      sendTransaction: async () => "transaction-hash",
      signMessage: async () => "signature",
      switchChain: async () => undefined,
    },
    supportedChainIds: [1],
    type: "generic",
  },
};

const buildControllerEffect = (
  overrides: Partial<BuildWagmiConfigOptions> = {}
) =>
  Effect.gen(function* () {
    const buildActions = yield* makeWagmiActions;
    return yield* buildWagmiConfig(
      {
        chainIconMapping: undefined,
        walletListFactory: undefined,
        disableInjectedProviderDiscovery: true,
        enabledNetworks: new Set(["ethereum", "cosmos", "polkadot", "tron"]),
        forceWalletConnectOnly: false,
        institutionalWallets: false,
        isMobileWallet: false,
        isLedgerLive: false,
        isSafe: false,
        mapWalletFn: undefined,
        walletPolicy: undefined,
        persistPublicKey: () => Effect.void,
        queryParams: Schema.decodeSync(InitParams)(emptyInitParams),
        solanaConnection: {} as SolanaConnection,
        solanaWallets: [],
        tonConnectManifestUrl: undefined,
        variant: "default",
        ...overrides,
      },
      buildActions,
      StellarWalletsKitPlatform.of({ load: Effect.succeed([]) })
    );
  }).pipe(Effect.provide(WagmiOperations.layer));

const buildController = (overrides: Partial<BuildWagmiConfigOptions> = {}) =>
  Effect.scoped(buildControllerEffect(overrides));

const expectEcosystemConnectorsSkipped = (
  controller: Effect.Success<ReturnType<typeof buildController>>
) => {
  expect(controller.cosmosConfig.connector).toBeNull();
  expect(controller.substrateConfig.connector).toBeNull();
  expect(controller.miscConfig.connectors).toEqual([
    null,
    null,
    null,
    null,
    null,
  ]);
  expect(Object.keys(controller.cosmosConfig.cosmosChainsMap)).toEqual([
    "cosmos",
  ]);
  expect(Object.keys(controller.substrateConfig.substrateChainsMap)).toEqual([
    "polkadot",
  ]);
  expect(Object.keys(controller.miscConfig.miscChainsMap)).toEqual(["tron"]);
  expect(controller.wagmiConfig.connectors.length).toBeGreaterThan(0);
};

describe("ecosystem connector gate", () => {
  it("builds ecosystem connectors only for the default host and institutional wallets", () => {
    expect(buildsEcosystemConnectors(gateInput())).toBe(true);
    expect(
      buildsEcosystemConnectors(gateInput({ institutionalWallets: true }))
    ).toBe(true);
    expect(buildsEcosystemConnectors(gateInput({ variant: "finery" }))).toBe(
      true
    );
    expect(
      buildsEcosystemConnectors(gateInput({ hasExternalProviders: true }))
    ).toBe(false);
    expect(buildsEcosystemConnectors(gateInput({ isSafe: true }))).toBe(false);
    expect(
      buildsEcosystemConnectors(gateInput({ isLedgerDappBrowser: true }))
    ).toBe(false);
    expect(
      buildsEcosystemConnectors(gateInput({ hasCustomWalletList: true }))
    ).toBe(false);
  });

  it("keeps ecosystem connectors when institutional wallets outrank a dedicated connector mode", () => {
    expect(
      buildsEcosystemConnectors(
        gateInput({
          hasCustomWalletList: true,
          hasExternalProviders: true,
          institutionalWallets: true,
          isLedgerDappBrowser: true,
          isSafe: true,
        })
      )
    ).toBe(true);
  });

  it.live(
    "leaves the Substrate connector chunk unloaded while keeping its chain map",
    () =>
      Effect.gen(function* () {
        const before = evaluated.substrateConnector;
        const gated = yield* getSubstrateConfig({
          buildConnectors: false,
          enabledNetworks: substrateNetworks,
          forceWalletConnectOnly: false,
        });

        expect(gated.connector).toBeNull();
        expect(Object.keys(gated.substrateChainsMap)).toEqual(["polkadot"]);
        expect(gated.substrateChains).toHaveLength(1);
        expect(evaluated.substrateConnector).toBe(before);

        const open = yield* getSubstrateConfig({
          buildConnectors: true,
          enabledNetworks: substrateNetworks,
          forceWalletConnectOnly: false,
        });

        expect(open.connector).not.toBeNull();
        expect(open.substrateChainsMap).toEqual(gated.substrateChainsMap);
        expect(evaluated.substrateConnector).toBe(before + 1);
      })
  );

  it.live(
    "leaves the misc connector chunks unloaded while keeping its chain map",
    () =>
      Effect.gen(function* () {
        const before = {
          cardano: evaluated.cardanoConnector,
          ton: evaluated.tonConnector,
          tron: evaluated.tronConnector,
        };
        const miscOptions = {
          enabledNetworks: miscNetworks,
          forceWalletConnectOnly: false,
          runWalletEffect,
          solanaConnection: {} as SolanaConnection,
          solanaWallets: [],
          tonConnectManifestUrl: undefined,
          variant: "default",
        } as const;
        const stellarWalletsKitPlatform = StellarWalletsKitPlatform.of({
          load: Effect.succeed([]),
        });
        const gated = yield* Effect.scoped(
          getMiscConfig({
            ...miscOptions,
            buildConnectors: false,
            stellarWalletsKitPlatform,
          })
        );

        expect(gated.connectors).toEqual([null, null, null, null, null]);
        expect(Object.keys(gated.miscChainsMap).sort()).toEqual([
          "cardano",
          "ton",
          "tron",
        ]);
        expect(gated.miscChains).toHaveLength(3);
        expect(evaluated.cardanoConnector).toBe(before.cardano);
        expect(evaluated.tonConnector).toBe(before.ton);
        expect(evaluated.tronConnector).toBe(before.tron);

        const open = yield* Effect.scoped(
          getMiscConfig({
            ...miscOptions,
            buildConnectors: true,
            stellarWalletsKitPlatform,
          })
        );

        expect(open.connectors.filter((value) => value !== null)).toHaveLength(
          3
        );
        expect(open.miscChainsMap).toEqual(gated.miscChainsMap);
        expect(evaluated.cardanoConnector).toBe(before.cardano + 1);
        expect(evaluated.tonConnector).toBe(before.ton + 1);
        expect(evaluated.tronConnector).toBe(before.tron + 1);
      })
  );

  it.live(
    "leaves the Cosmos wallet manager unloaded while keeping its chain map",
    () =>
      Effect.gen(function* () {
        const before = evaluated.cosmosWalletManager;
        const cosmosOptions = {
          enabledNetworks: cosmosNetworks,
          forceWalletConnectOnly: false,
          persistPublicKey: async () => undefined,
        } as const;
        const gated = yield* getCosmosConfig({
          ...cosmosOptions,
          buildConnectors: false,
        });

        expect(gated.connector).toBeNull();
        expect(Object.keys(gated.cosmosChainsMap)).toEqual(["cosmos"]);
        expect(gated.cosmosWagmiChains).toHaveLength(1);
        expect(evaluated.cosmosWalletManager).toBe(before);

        const open = yield* getCosmosConfig({
          ...cosmosOptions,
          buildConnectors: true,
        });

        expect(open.connector).not.toBeNull();
        expect(open.cosmosChainsMap).toEqual(gated.cosmosChainsMap);
        expect(evaluated.cosmosWalletManager).toBe(before + 1);
      })
  );

  it.live("loads Stellar Wallets Kit only for enabled mainnet topology", () =>
    Effect.gen(function* () {
      const before = evaluated.stellarConnectorCalls;
      const stellarWalletsKitPlatform = StellarWalletsKitPlatform.of({
        load: Effect.succeed([]),
      });
      const miscOptions = {
        enabledNetworks: new Set<Network>(["stellar"]),
        forceWalletConnectOnly: false,
        runWalletEffect,
        solanaConnection: {} as SolanaConnection,
        solanaWallets: [],
        tonConnectManifestUrl: undefined,
        variant: "default",
      } as const;

      const gated = yield* Effect.scoped(
        getMiscConfig({
          ...miscOptions,
          buildConnectors: false,
          stellarWalletsKitPlatform,
        })
      );
      expect(gated.connectors).toEqual([null, null, null, null, null]);
      expect(evaluated.stellarConnectorCalls).toBe(before);

      const open = yield* Effect.scoped(
        getMiscConfig({
          ...miscOptions,
          buildConnectors: true,
          stellarWalletsKitPlatform,
        })
      );
      expect(open.connectors[4]).not.toBeNull();
      expect(evaluated.stellarConnectorCalls).toBe(before + 1);
    })
  );

  it.live(
    "keeps other misc adapters when Stellar Wallets Kit initialization fails",
    () =>
      Effect.gen(function* () {
        const stellarWalletsKitPlatform = StellarWalletsKitPlatform.of({
          load: Effect.fail(
            new WalletIntegrationError({
              message: "Stellar Wallets Kit unavailable",
              operation: "stellar-wallets-kit-load",
            })
          ),
        } satisfies StellarWalletsKitPlatformService);

        const result = yield* Effect.scoped(
          getMiscConfig({
            buildConnectors: true,
            enabledNetworks: new Set<Network>(["stellar", "tron"]),
            forceWalletConnectOnly: false,
            stellarWalletsKitPlatform,
            runWalletEffect,
            solanaConnection: {} as SolanaConnection,
            solanaWallets: [],
            tonConnectManifestUrl: undefined,
            variant: "default",
          })
        );

        expect(result.connectors[0]).not.toBeNull();
        expect(result.connectors[4]).toBeNull();
        expect(Object.keys(result.miscChainsMap).sort()).toEqual([
          "stellar",
          "tron",
        ]);
      })
  );

  it.effect("loads the generic Stellar connector in mobile environments", () =>
    Effect.gen(function* () {
      const before = evaluated.stellarConnectorCalls;
      const controller = yield* buildController({
        enabledNetworks: new Set(["ethereum", "stellar"]),
        isMobileWallet: true,
      });

      expect(controller.miscConfig.miscChainsMap).toHaveProperty("stellar");
      expect(evaluated.stellarConnectorCalls).toBe(before + 1);
    })
  );

  it.live(
    "keeps cosmos chains when the wallet manager fails to initialize",
    () =>
      Effect.gen(function* () {
        evaluated.failCosmosWalletManager = true;

        const result = yield* getCosmosConfig({
          buildConnectors: true,
          enabledNetworks: cosmosNetworks,
          forceWalletConnectOnly: false,
          persistPublicKey: async () => undefined,
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              evaluated.failCosmosWalletManager = false;
            })
          )
        );

        expect(result.connector).toBeNull();
        expect(Object.keys(result.cosmosChainsMap)).toEqual(["cosmos"]);
      })
  );

  it.effect("skips ecosystem connectors in external provider mode", () =>
    Effect.gen(function* () {
      expectEcosystemConnectorsSkipped(
        yield* buildController({
          externalProviders,
        })
      );
    })
  );

  it.effect("skips ecosystem connectors in Safe mode", () =>
    Effect.gen(function* () {
      const controller = yield* buildController({ isSafe: true });

      expect(controller.safeConnector).not.toBeNull();
      expectEcosystemConnectorsSkipped(controller);
    })
  );

  it.effect("skips ecosystem connectors for a captured Ledger generation", () =>
    Effect.gen(function* () {
      const controller = yield* buildController({ isLedgerLive: true });

      expect(controller.ledgerLiveConnector).not.toBeNull();
      expectEcosystemConnectorsSkipped(controller);
    })
  );

  it.effect("skips ecosystem connectors for a custom Wallet List", () =>
    Effect.gen(function* () {
      expectEcosystemConnectorsSkipped(
        yield* buildController({
          walletListFactory: () => [
            {
              groupName: "Custom",
              wallets: [
                () => ({
                  chainGroup: { iconUrl: "", id: "custom", title: "Custom" },
                  createConnector: (() => () => ({})) as never,
                  iconBackground: "#fff",
                  iconUrl: "",
                  id: "custom",
                  name: "Custom",
                }),
              ],
            },
          ],
        })
      );
    })
  );

  it.live("adds each provider once from cumulative MIPD announcements", () =>
    Effect.gen(function* () {
      const connectorIds = yield* Effect.scoped(
        Effect.gen(function* () {
          const controller = yield* buildControllerEffect({
            disableInjectedProviderDiscovery: false,
          });
          const announce = (rdns: string, uuid: string) =>
            window.dispatchEvent(
              new CustomEvent("eip6963:announceProvider", {
                detail: {
                  info: {
                    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
                    name: rdns,
                    rdns,
                    uuid,
                  },
                  provider: { request: async () => null },
                },
              })
            );

          yield* Effect.sync(() => announce("wallet.a", crypto.randomUUID()));
          yield* Effect.sync(() => announce("wallet.b", crypto.randomUUID()));

          return controller.wagmiConfig.connectors.map(
            (connector) => connector.id
          );
        })
      );

      expect(connectorIds.filter((id) => id === "wallet.a")).toHaveLength(1);
      expect(connectorIds.filter((id) => id === "wallet.b")).toHaveLength(1);
    })
  );

  it.effect("still builds ecosystem connectors for a default host", () =>
    Effect.gen(function* () {
      const controller = yield* buildController();

      expect(controller.cosmosConfig.connector).not.toBeNull();
      expect(controller.substrateConfig.connector).not.toBeNull();
      expect(
        controller.miscConfig.connectors.filter((value) => value !== null)
      ).toHaveLength(1);
    })
  );
});
