import { describe, expect, it } from "@effect/vitest";
import { connectorsForWallets } from "@stakekit/rainbowkit";
import { type Chain, createClient } from "viem";
import { arbitrum, mainnet, polygon } from "viem/chains";
import { createConfig, http } from "wagmi";
import {
  connect,
  disconnect,
  getConnection,
  reconnect,
  watchConnection,
} from "wagmi/actions";
import type { ExternalProviderSnapshot } from "../../../src/public-api/external-provider-contract";
import type { SKExternalProviders } from "../../../src/public-api/types";
import { solana } from "../../../src/services/wallet/internal/adapters/configured-chains";
import {
  externalProviderConnector,
  isExternalProviderConnector,
} from "../../../src/services/wallet/internal/adapters/external-provider";
import { normalizeWalletState } from "../../../src/services/wallet/internal/runtime/state-projection";
import { WalletRuntimeInvariantError } from "../../../src/services/wallet/wallet-errors";
import { disconnectedLedgerConnectorState } from "../../../src/services/wallet/wallet-state";
import { runWalletEffect } from "../../utils/run-wallet-effect";

const firstAddress = "0x0000000000000000000000000000000000000001";
const secondAddress = "0x0000000000000000000000000000000000000002";

const makeHarness = (
  snapshot: Partial<SKExternalProviders> = {},
  chains: readonly [Chain, ...Chain[]] = [mainnet, arbitrum, polygon, solana]
) => {
  const variant: { current: ExternalProviderSnapshot } = {
    current: {
      currentAddress: firstAddress,
      provider: {
        sendTransaction: async () => "transaction-hash",
        signMessage: async () => "signature",
        switchChain: async () => undefined,
      },
      type: "generic",
      ...snapshot,
    },
  };
  const config = createConfig({
    chains,
    client: ({ chain }) => createClient({ chain, transport: http() }),
    connectors: connectorsForWallets(
      [externalProviderConnector(variant, runWalletEffect)],
      { appName: "Connector regression", projectId: "connector-regression" }
    ),
    multiInjectedProviderDiscovery: false,
    storage: null,
  });
  const connector = config.connectors[0];
  if (!connector || !isExternalProviderConnector(connector)) {
    throw new Error("External provider connector missing");
  }
  return { config, connector, variant };
};

describe("external-provider connector", () => {
  it.each([arbitrum, polygon, solana])(
    "connects directly to the host's $name routing ID without publishing Ethereum",
    async (chain) => {
      const { config, connector } = makeHarness({ currentChain: chain.id });
      const connectedChainIds: Array<number | undefined> = [];
      const unsubscribe = watchConnection(config, {
        onChange: (connection) => {
          if (connection.isConnected) {
            connectedChainIds.push(connection.chainId);
          }
        },
      });

      try {
        await expect(connector.getChainId()).resolves.toBe(chain.id);
        await expect(connect(config, { connector })).resolves.toMatchObject({
          accounts: [firstAddress],
          chainId: chain.id,
        });
        expect(getConnection(config)).toMatchObject({
          address: firstAddress,
          chain,
          chainId: chain.id,
          status: "connected",
        });
        expect(connectedChainIds).toEqual([chain.id]);
      } finally {
        unsubscribe();
        await disconnect(config);
      }
    }
  );

  it("reconnects with the latest host chain and address", async () => {
    const { config, connector, variant } = makeHarness({
      currentChain: arbitrum.id,
    });
    await connect(config, { connector });
    await disconnect(config);
    variant.current = {
      ...variant.current,
      currentAddress: secondAddress,
      currentChain: polygon.id,
    };
    const connectedChainIds: Array<number | undefined> = [];
    const unsubscribe = watchConnection(config, {
      onChange: (connection) => {
        if (connection.isConnected) {
          connectedChainIds.push(connection.chainId);
        }
      },
    });

    try {
      await expect(
        reconnect(config, { connectors: [connector] })
      ).resolves.toMatchObject([
        { accounts: [secondAddress], chainId: polygon.id },
      ]);
      await expect(connector.getChainId()).resolves.toBe(polygon.id);
      expect(getConnection(config)).toMatchObject({
        address: secondAddress,
        chainId: polygon.id,
        status: "connected",
      });
      expect(connectedChainIds).toEqual([polygon.id]);
    } finally {
      unsubscribe();
      await disconnect(config);
    }
  });

  it("uses the first configured chain when the host omits its chain", async () => {
    const { config, connector } = makeHarness();
    try {
      await expect(connect(config, { connector })).resolves.toMatchObject({
        chainId: mainnet.id,
      });
    } finally {
      await disconnect(config);
    }
  });

  it("preserves supported-chain fallback and its change notification when the host omits its chain", async () => {
    const { config, connector, variant } = makeHarness({
      supportedChainIds: [polygon.id, arbitrum.id],
    });
    const changes: Array<number | undefined> = [];
    connector.emitter.on("change", (change) => changes.push(change.chainId));

    try {
      await expect(connect(config, { connector })).resolves.toMatchObject({
        chainId: arbitrum.id,
      });
      variant.current = { ...variant.current, supportedChainIds: [polygon.id] };
      connector.onSupportedChainsChanged({
        currentChainId: arbitrum.id,
        supportedChainIds: [polygon.id],
      });

      await expect(connector.getChainId()).resolves.toBe(polygon.id);
      expect(changes).toEqual([polygon.id]);
      expect(getConnection(config)).toMatchObject({
        chainId: polygon.id,
        status: "connected",
      });
    } finally {
      await disconnect(config);
    }
  });

  it("does not replace a live host chain when the supported list removes it", async () => {
    const { config, connector, variant } = makeHarness({
      currentChain: polygon.id,
    });
    const changes: Array<number | undefined> = [];
    connector.emitter.on("change", (change) => changes.push(change.chainId));

    try {
      await connect(config, { connector });
      variant.current = { ...variant.current, supportedChainIds: [mainnet.id] };
      connector.onSupportedChainsChanged({
        currentChainId: polygon.id,
        supportedChainIds: [mainnet.id],
      });

      await expect(connector.getChainId()).resolves.toBe(polygon.id);
      expect(changes).toEqual([]);
      expect(getConnection(config).chainId).toBe(polygon.id);

      variant.current = { ...variant.current, currentChain: arbitrum.id };
      connector.onChainChanged(`0x${arbitrum.id.toString(16)}`);

      await expect(connector.getChainId()).resolves.toBe(arbitrum.id);
      expect(changes).toEqual([arbitrum.id]);
      expect(getConnection(config).chainId).toBe(arbitrum.id);
    } finally {
      await disconnect(config);
    }
  });

  it("keeps a host chain outside the topology unsupported", async () => {
    const { config, connector } = makeHarness(
      { currentChain: arbitrum.id, supportedChainIds: [mainnet.id] },
      [mainnet]
    );
    try {
      await connect(config, { connector });
      const connection = getConnection(config);
      expect(connection.chainId).toBe(arbitrum.id);
      expect(connection.chain).toBeUndefined();
      expect(
        normalizeWalletState({
          additionalAddresses: null,
          connection,
          connectorChains: [mainnet],
          controller: {
            cosmosConfig: { cosmosChainsMap: {} },
            evmConfig: {
              evmChainsMap: {
                ethereum: {
                  network: "ethereum",
                  type: "evm",
                  wagmiChain: mainnet,
                },
              },
            },
            isLedgerLive: false,
            miscConfig: { miscChainsMap: {} },
            substrateConfig: { substrateChainsMap: {} },
          },
          forceAddress: undefined,
          ledgerState: disconnectedLedgerConnectorState,
        })
      ).toMatchObject({
        address: firstAddress,
        chain: null,
        network: null,
        status: "unsupported",
      });
    } finally {
      await disconnect(config);
    }
  });

  it.each([
    { supportedChainIds: [], currentChain: undefined },
    { supportedChainIds: [], currentChain: mainnet.id },
    { supportedChainIds: [arbitrum.id], currentChain: undefined },
    { supportedChainIds: [arbitrum.id], currentChain: arbitrum.id },
  ])(
    "rejects an empty configured intersection: $supportedChainIds / $currentChain",
    (snapshot) => {
      expect(() => makeHarness(snapshot, [mainnet])).toThrow(
        WalletRuntimeInvariantError
      );
    }
  );

  it("rejects empty live chain lists instead of widening them to all chains", () => {
    const { connector } = makeHarness({ currentChain: mainnet.id });
    expect(() =>
      connector.onSupportedChainsChanged({
        currentChainId: mainnet.id,
        supportedChainIds: [],
      })
    ).toThrow(WalletRuntimeInvariantError);
  });

  it("does not reconnect an external provider without a host account", async () => {
    const { config, connector } = makeHarness({
      currentAddress: "",
      currentChain: mainnet.id,
    });
    expect(await reconnect(config)).toEqual([]);
    expect(getConnection(config).status).toBe("disconnected");
    await expect(connect(config, { connector })).rejects.toThrow();
    expect(getConnection(config).status).toBe("disconnected");
  });

  it("disconnects when the host clears its last account", async () => {
    const { config, connector } = makeHarness({ currentChain: mainnet.id });
    await connect(config, { connector });
    connector.onAccountsChanged([""]);
    expect(getConnection(config)).toMatchObject({
      status: "disconnected",
      address: undefined,
    });
    expect(config.state.connections.size).toBe(0);
  });
});
