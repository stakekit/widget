import {
  type Adapter,
  type WalletName,
  WalletReadyState,
} from "@solana/wallet-adapter-base";
import { Connection } from "@solana/web3.js";
import { Effect, Stream } from "effect";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createConfig, createConnector, http } from "wagmi";
import { connect, disconnect, watchConnectors } from "wagmi/actions";
import { solana } from "../../../src/domain/types/chains/misc";
import { installSolanaConnectorMembership } from "../../../src/services/wallet/solana-connector-membership";
import type {
  HeadlessSolanaRuntime,
  SolanaWalletDescriptor,
  SolanaWalletSnapshot,
} from "../../../src/services/wallet/solana-runtime";

const account = "0x0000000000000000000000000000000000000501" as Address;

const makeAdapter = (name: string) => ({ name: name as WalletName }) as Adapter;

const descriptor = (
  adapter: Adapter,
  source: SolanaWalletDescriptor["source"],
  readyState = WalletReadyState.Installed
): SolanaWalletDescriptor => ({ adapter, readyState, source });

const makeRuntime = (initial: SolanaWalletSnapshot) => {
  const listeners = new Set<() => Promise<void> | void>();
  let snapshot = initial;

  const runtime = {
    connection: new Connection("https://api.mainnet-beta.solana.com"),
    getWalletSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies HeadlessSolanaRuntime;

  return {
    emit: async (next: SolanaWalletSnapshot) => {
      snapshot = next;
      await Promise.all([...listeners].map((listener) => listener()));
    },
    listenerCount: () => listeners.size,
    runtime,
  };
};

const makeConnectorFactory = (
  wallet: SolanaWalletDescriptor,
  operations: string[]
) =>
  createConnector((config) => ({
    $filteredChains: Stream.succeed([solana]),
    id: wallet.adapter.name,
    isSolanaConnector: true,
    name: wallet.adapter.name,
    rkDetails: {
      groupName: "Solana",
      installed:
        wallet.readyState === WalletReadyState.Installed ||
        wallet.readyState === WalletReadyState.Loadable,
    },
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

const makeHarness = (initial: SolanaWalletDescriptor) => {
  const operations: string[] = [];
  const runtime = makeRuntime({ wallets: [initial] });
  const config = createConfig({
    chains: [solana],
    connectors: [makeConnectorFactory(initial, operations)],
    transports: { [solana.id]: http() },
  });

  return {
    config,
    createConnector: async (wallet: SolanaWalletDescriptor) =>
      makeConnectorFactory(wallet, operations),
    operations,
    runtime,
  };
};

const waitForCondition = Effect.fn("waitForCondition")(function* (
  condition: () => boolean
) {
  while (!condition()) yield* Effect.yieldNow;
});

describe("Solana connector membership", () => {
  it("defers a same-name Standard replacement until the active fallback disconnects", async () => {
    const fallbackAdapter = makeAdapter("Phantom");
    const standardAdapter = makeAdapter("Phantom");
    const fallback = descriptor(fallbackAdapter, "fallback");
    const standard = descriptor(standardAdapter, "standard");
    const harness = makeHarness(fallback);

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* installSolanaConnectorMembership({
            config: harness.config,
            createConnector: harness.createConnector,
            runtime: harness.runtime.runtime,
          });
          const fallbackConnector = harness.config.connectors[0]!;
          yield* Effect.promise(() =>
            connect(harness.config, { connector: fallbackConnector })
          );

          yield* Effect.promise(() =>
            harness.runtime.emit({ wallets: [standard] })
          );
          expect(harness.config.connectors[0]).toBe(fallbackConnector);

          yield* Effect.promise(() =>
            harness.runtime.emit({ wallets: [fallback] })
          );
          expect(harness.config.connectors[0]).toBe(fallbackConnector);

          yield* Effect.promise(() =>
            harness.runtime.emit({ wallets: [standard] })
          );
          yield* Effect.promise(() =>
            disconnect(harness.config, { connector: fallbackConnector })
          );
          yield* waitForCondition(
            () =>
              harness.config.connectors[0] &&
              "solanaAdapter" in harness.config.connectors[0] &&
              harness.config.connectors[0].solanaAdapter === standardAdapter
          );
        })
      )
    );

    expect(harness.runtime.listenerCount()).toBe(0);
  });

  it("disconnects an unregistered active Standard before publishing its fallback", async () => {
    const standard = descriptor(makeAdapter("Phantom"), "standard");
    const fallback = descriptor(makeAdapter("Phantom"), "fallback");
    const harness = makeHarness(standard);

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* installSolanaConnectorMembership({
            config: harness.config,
            createConnector: harness.createConnector,
            runtime: harness.runtime.runtime,
          });
          const standardConnector = harness.config.connectors[0]!;
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
          yield* Effect.addFinalizer(() => Effect.sync(unsubscribe));
          yield* Effect.promise(() =>
            connect(harness.config, { connector: standardConnector })
          );

          yield* Effect.promise(() =>
            harness.runtime.emit({ wallets: [fallback] })
          );
        })
      )
    );

    expect(harness.operations).toEqual([
      "disconnect:standard",
      "publish:fallback",
    ]);
  });

  it("replaces an unregistered inactive Standard with its fallback", async () => {
    const standard = descriptor(makeAdapter("Phantom"), "standard");
    const fallback = descriptor(makeAdapter("Phantom"), "fallback");
    const harness = makeHarness(standard);

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* installSolanaConnectorMembership({
            config: harness.config,
            createConnector: harness.createConnector,
            runtime: harness.runtime.runtime,
          });
          yield* Effect.promise(() =>
            harness.runtime.emit({ wallets: [fallback] })
          );

          expect(harness.config.connectors[0]).toMatchObject({
            solanaAdapter: fallback.adapter,
            solanaAdapterSource: "fallback",
          });
        })
      )
    );

    expect(harness.operations).toEqual([]);
  });

  it("refreshes readiness with the same uid, emitter, methods, and adapter", async () => {
    const adapter = makeAdapter("Phantom");
    const initial = descriptor(
      adapter,
      "fallback",
      WalletReadyState.NotDetected
    );
    const ready = descriptor(adapter, "fallback", WalletReadyState.Loadable);
    const harness = makeHarness(initial);

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* installSolanaConnectorMembership({
            config: harness.config,
            createConnector: harness.createConnector,
            runtime: harness.runtime.runtime,
          });
          const before = harness.config.connectors[0]!;
          yield* Effect.promise(() =>
            harness.runtime.emit({ wallets: [ready] })
          );
          const after = harness.config.connectors[0]!;

          expect(after).not.toBe(before);
          expect(after.uid).toBe(before.uid);
          expect(after.emitter).toBe(before.emitter);
          expect(after.connect).toBe(before.connect);
          expect(after).toMatchObject({
            rkDetails: { installed: true },
            solanaAdapter: adapter,
          });
        })
      )
    );
  });
});
