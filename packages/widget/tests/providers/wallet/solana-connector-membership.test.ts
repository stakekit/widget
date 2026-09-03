import { describe, expect, it } from "@effect/vitest";
import {
  type Adapter,
  type WalletName,
  WalletReadyState,
} from "@solana/wallet-adapter-base";
import { Connection } from "@solana/web3.js";
import { Effect, Stream } from "effect";
import type { Address } from "viem";
import { createConfig, createConnector, http } from "wagmi";
import { connect, disconnect, watchConnectors } from "wagmi/actions";
import { solana } from "../../../src/services/wallet/internal/adapters/configured-chains";
import type { SolanaRuntime } from "../../../src/services/wallet/internal/platform/solana-platform";
import { installSolanaConnectorMembership } from "../../../src/services/wallet/internal/runtime/solana-connector-membership";
import type { SolanaWalletDescriptor } from "../../../src/services/wallet/internal/runtime/solana-runtime";

const account = "0x0000000000000000000000000000000000000501" as Address;

const makeAdapter = (name: string) => ({ name: name as WalletName }) as Adapter;

const descriptor = (
  adapter: Adapter,
  source: SolanaWalletDescriptor["source"]
): SolanaWalletDescriptor => ({
  adapter,
  readyState: WalletReadyState.Installed,
  source,
});

const makeConnectorFactory = (
  wallet: SolanaWalletDescriptor,
  operations: string[]
) =>
  createConnector((config) => ({
    $filteredChains: Stream.succeed([solana]),
    id: wallet.adapter.name,
    isSolanaConnector: true,
    name: wallet.adapter.name,
    rkDetails: { groupName: "Solana", installed: true },
    solanaAdapter: wallet.adapter,
    solanaAdapterSource: wallet.source,
    type: `solana-${wallet.source}`,
    connect: async (parameters) =>
      ({
        accounts: parameters?.withCapabilities
          ? [{ address: account, capabilities: {} }]
          : [account],
        chainId: solana.id,
      }) as never,
    disconnect: async () => {
      operations.push(`disconnect:${wallet.source}`);
    },
    getAccounts: async () => [account],
    getChainId: async () => solana.id,
    getProvider: async () => ({}),
    isAuthorized: async () => false,
    onAccountsChanged: () => undefined,
    onChainChanged: () => undefined,
    onDisconnect: () => config.emitter.emit("disconnect"),
    sendTransaction: async () => "signature",
  }));

const makeHarness = (
  visible: SolanaWalletDescriptor,
  discovered: SolanaWalletDescriptor
) => {
  const operations: string[] = [];
  const config = createConfig({
    chains: [solana],
    connectors: [makeConnectorFactory(visible, operations)],
    transports: { [solana.id]: http() },
  });
  const runtime = {
    connection: new Connection("https://api.mainnet-beta.solana.com"),
    current: Effect.succeed({ wallets: [discovered] }),
    states: Stream.never,
  } satisfies SolanaRuntime;
  const core = {
    current: Effect.succeed({ connection: {} as never, connectors: [] }),
    states: Stream.never,
  };
  return {
    actions: {
      disconnect: (input: Parameters<typeof disconnect>[1]) =>
        Effect.tryPromise(() => disconnect(config, input)).pipe(Effect.orDie),
    },
    config,
    core,
    createConnector: (wallet: SolanaWalletDescriptor) =>
      Effect.succeed(makeConnectorFactory(wallet, operations)),
    operations,
    runtime,
  };
};

describe("Solana connector membership", () => {
  it.effect("replaces an inactive same-name fallback during scoped setup", () =>
    Effect.gen(function* () {
      const fallback = descriptor(makeAdapter("Phantom"), "fallback");
      const standard = descriptor(makeAdapter("Phantom"), "standard");
      const harness = makeHarness(fallback, standard);

      yield* Effect.scoped(
        installSolanaConnectorMembership({
          actions: harness.actions,
          config: harness.config,
          core: harness.core,
          createConnector: harness.createConnector,
          runtime: harness.runtime,
        })
      );

      expect(harness.config.connectors[0]).toMatchObject({
        solanaAdapter: standard.adapter,
        solanaAdapterSource: "standard",
      });
    })
  );

  it.effect(
    "disconnects an active Standard before publishing its fallback",
    () =>
      Effect.gen(function* () {
        const standard = descriptor(makeAdapter("Phantom"), "standard");
        const fallback = descriptor(makeAdapter("Phantom"), "fallback");
        const harness = makeHarness(standard, fallback);
        const visible = harness.config.connectors[0]!;
        yield* Effect.promise(() =>
          connect(harness.config, { connector: visible })
        );
        const unsubscribe = watchConnectors(harness.config, {
          onChange: (connectors) => {
            const connector = connectors[0];
            if (connector && "solanaAdapterSource" in connector) {
              harness.operations.push(
                `publish:${String(connector.solanaAdapterSource)}`
              );
            }
          },
        });

        yield* Effect.scoped(
          installSolanaConnectorMembership({
            actions: harness.actions,
            config: harness.config,
            core: harness.core,
            createConnector: harness.createConnector,
            runtime: harness.runtime,
          })
        );
        unsubscribe();

        expect(harness.operations).toEqual([
          "disconnect:standard",
          "publish:fallback",
        ]);
      })
  );
});
