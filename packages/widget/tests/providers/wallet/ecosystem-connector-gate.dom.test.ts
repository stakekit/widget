import type { Connection as SolanaConnection } from "@solana/web3.js";
import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { InitParams } from "../../../src/domain/schema/init-params";
import type { Network } from "../../../src/domain/schema/network-model";
import type { CurrentRef } from "../../../src/domain/types/external-providers";
import type { SKExternalProviders } from "../../../src/public-api/types";
import { buildsEcosystemConnectors } from "../../../src/services/wallet/connector-mode";
import { getConfig as getCosmosConfig } from "../../../src/services/wallet/connectors/cosmos/config";
import { getConfig as getMiscConfig } from "../../../src/services/wallet/connectors/misc/config";
import { getConfig as getSubstrateConfig } from "../../../src/services/wallet/connectors/substrate/config";
import { WagmiOperations } from "../../../src/services/wallet/platform/wagmi-operations";
import { makeWagmiActions } from "../../../src/services/wallet/wagmi-actions";
import {
  type BuildWagmiConfigOptions,
  buildWagmiConfig,
} from "../../../src/services/wallet/wagmi-config";

const browser = vi.hoisted(() => ({ isLedgerDappBrowser: false }));

/**
 * Counts how often each connector chunk is evaluated. The gate exists so those
 * dynamic imports never happen, so the counters are the assertion that matters.
 */
const evaluated = vi.hoisted(() => ({
  cardanoConnector: 0,
  cosmosWalletManager: 0,
  substrateConnector: 0,
  tonConnector: 0,
  tronConnector: 0,
}));

vi.mock("../../../src/services/wallet/browser-environment", () => ({
  isLedgerDappBrowserProvider: () => browser.isLedgerDappBrowser,
  isMobileWalletEnvironment: () => false,
  isWalletIframe: () => true,
}));

vi.mock(
  "../../../src/services/wallet/connectors/substrate/substrate-connector",
  () => {
    evaluated.substrateConnector += 1;

    return {
      getSubstrateConnectors: () =>
        Effect.succeed({ groupName: "Substrate", wallets: [] }),
    };
  }
);

vi.mock("../../../src/services/wallet/connectors/misc/tron-connector", () => {
  evaluated.tronConnector += 1;

  return { getTronConnectors: () => ({ groupName: "Tron", wallets: [] }) };
});

vi.mock(
  "../../../src/services/wallet/connectors/misc/cardano-connector",
  () => {
    evaluated.cardanoConnector += 1;

    return {
      getCardanoConnectors: () => ({ groupName: "Cardano", wallets: [] }),
    };
  }
);

vi.mock("../../../src/services/wallet/connectors/misc/ton-connector", () => {
  evaluated.tonConnector += 1;

  return { getTonConnectors: () => ({ groupName: "TON", wallets: [] }) };
});

vi.mock("../../../src/services/wallet/connectors/cosmos/wallet-manager", () => {
  evaluated.cosmosWalletManager += 1;

  return {
    getWalletManager: () => ({
      connector: { groupName: "Cosmos", wallets: [] },
      walletManager: { onMounted: async () => undefined },
    }),
  };
});

const cosmosNetworks = new Set<Network>(["cosmos"]);
const miscNetworks = new Set<Network>(["cardano", "ton", "tron"]);
const substrateNetworks = new Set<Network>(["polkadot"]);

type ConnectorModeInput = Parameters<typeof buildsEcosystemConnectors>[0];

const gateInput = (
  overrides: Partial<ConnectorModeInput> = {}
): ConnectorModeInput => ({
  hasCustomConnectors: false,
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

const buildController = (overrides: Partial<BuildWagmiConfigOptions> = {}) =>
  Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const buildActions = yield* makeWagmiActions;
        return yield* buildWagmiConfig(
          {
            chainIconMapping: undefined,
            customConnectors: undefined,
            disableInjectedProviderDiscovery: true,
            enabledNetworks: new Set([
              "ethereum",
              "cosmos",
              "polkadot",
              "tron",
            ]),
            forceWalletConnectOnly: false,
            institutionalWallets: false,
            isLedgerLive: false,
            isSafe: false,
            mapWalletFn: undefined,
            mapWalletListFn: undefined,
            persistPublicKey: () => Effect.void,
            queryParams: Schema.decodeSync(InitParams)(emptyInitParams),
            solanaConnection: {} as SolanaConnection,
            solanaWallets: [],
            tonConnectManifestUrl: undefined,
            variant: "default",
            ...overrides,
          },
          buildActions
        );
      }).pipe(Effect.provide(WagmiOperations.layer))
    )
  );

const expectEcosystemConnectorsSkipped = (
  controller: Awaited<ReturnType<typeof buildController>>
) => {
  expect(controller.cosmosConfig.connector).toBeNull();
  expect(controller.substrateConfig.connector).toBeNull();
  expect(controller.miscConfig.connectors).toEqual([null, null, null, null]);
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
      buildsEcosystemConnectors(gateInput({ hasCustomConnectors: true }))
    ).toBe(false);
  });

  it("keeps ecosystem connectors when institutional wallets outrank a dedicated connector mode", () => {
    expect(
      buildsEcosystemConnectors(
        gateInput({
          hasCustomConnectors: true,
          hasExternalProviders: true,
          institutionalWallets: true,
          isLedgerDappBrowser: true,
          isSafe: true,
        })
      )
    ).toBe(true);
  });

  it("leaves the Substrate connector chunk unloaded while keeping its chain map", async () => {
    const before = evaluated.substrateConnector;
    const gated = await Effect.runPromise(
      getSubstrateConfig({
        buildConnectors: false,
        enabledNetworks: substrateNetworks,
        forceWalletConnectOnly: false,
      })
    );

    expect(gated.connector).toBeNull();
    expect(Object.keys(gated.substrateChainsMap)).toEqual(["polkadot"]);
    expect(gated.substrateChains).toHaveLength(1);
    expect(evaluated.substrateConnector).toBe(before);

    const open = await Effect.runPromise(
      getSubstrateConfig({
        buildConnectors: true,
        enabledNetworks: substrateNetworks,
        forceWalletConnectOnly: false,
      })
    );

    expect(open.connector).not.toBeNull();
    expect(open.substrateChainsMap).toEqual(gated.substrateChainsMap);
    expect(evaluated.substrateConnector).toBe(before + 1);
  });

  it("leaves the misc connector chunks unloaded while keeping its chain map", async () => {
    const before = {
      cardano: evaluated.cardanoConnector,
      ton: evaluated.tonConnector,
      tron: evaluated.tronConnector,
    };
    const miscOptions = {
      enabledNetworks: miscNetworks,
      forceWalletConnectOnly: false,
      solanaConnection: {} as SolanaConnection,
      solanaWallets: [],
      tonConnectManifestUrl: undefined,
      variant: "default",
    } as const;
    const gated = await Effect.runPromise(
      getMiscConfig({ ...miscOptions, buildConnectors: false })
    );

    expect(gated.connectors).toEqual([null, null, null, null]);
    expect(Object.keys(gated.miscChainsMap).sort()).toEqual([
      "cardano",
      "ton",
      "tron",
    ]);
    expect(gated.miscChains).toHaveLength(3);
    expect(evaluated.cardanoConnector).toBe(before.cardano);
    expect(evaluated.tonConnector).toBe(before.ton);
    expect(evaluated.tronConnector).toBe(before.tron);

    const open = await Effect.runPromise(
      getMiscConfig({ ...miscOptions, buildConnectors: true })
    );

    expect(open.connectors.filter((value) => value !== null)).toHaveLength(3);
    expect(open.miscChainsMap).toEqual(gated.miscChainsMap);
    expect(evaluated.cardanoConnector).toBe(before.cardano + 1);
    expect(evaluated.tonConnector).toBe(before.ton + 1);
    expect(evaluated.tronConnector).toBe(before.tron + 1);
  });

  it("leaves the Cosmos wallet manager unloaded while keeping its chain map", async () => {
    const before = evaluated.cosmosWalletManager;
    const cosmosOptions = {
      enabledNetworks: cosmosNetworks,
      forceWalletConnectOnly: false,
      persistPublicKey: async () => undefined,
    } as const;
    const gated = await Effect.runPromise(
      getCosmosConfig({ ...cosmosOptions, buildConnectors: false })
    );

    expect(gated.connector).toBeNull();
    expect(Object.keys(gated.cosmosChainsMap)).toEqual(["cosmos"]);
    expect(gated.cosmosWagmiChains).toHaveLength(1);
    expect(evaluated.cosmosWalletManager).toBe(before);

    const open = await Effect.runPromise(
      getCosmosConfig({ ...cosmosOptions, buildConnectors: true })
    );

    expect(open.connector).not.toBeNull();
    expect(open.cosmosChainsMap).toEqual(gated.cosmosChainsMap);
    expect(evaluated.cosmosWalletManager).toBe(before + 1);
  });

  it("skips ecosystem connectors in external provider mode", async () => {
    expectEcosystemConnectorsSkipped(
      await buildController({
        externalProviders,
      })
    );
  });

  it("skips ecosystem connectors in Safe mode", async () => {
    const controller = await buildController({ isSafe: true });

    expect(controller.safeConnector).not.toBeNull();
    expectEcosystemConnectorsSkipped(controller);
  });

  it("skips ecosystem connectors in the Ledger dApp browser", async () => {
    browser.isLedgerDappBrowser = true;

    try {
      const controller = await buildController();

      expect(controller.ledgerLiveConnector).not.toBeNull();
      expectEcosystemConnectorsSkipped(controller);
    } finally {
      browser.isLedgerDappBrowser = false;
    }
  });

  it("skips ecosystem connectors when the host supplies custom connectors", async () => {
    expectEcosystemConnectorsSkipped(
      await buildController({
        customConnectors: () => [
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
  });

  it("still builds ecosystem connectors for a default host", async () => {
    const controller = await buildController();

    expect(controller.cosmosConfig.connector).not.toBeNull();
    expect(controller.substrateConfig.connector).not.toBeNull();
    expect(
      controller.miscConfig.connectors.filter((value) => value !== null)
    ).toHaveLength(1);
  });
});
