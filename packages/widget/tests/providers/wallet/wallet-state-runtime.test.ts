import type { ChainWalletBase } from "@cosmos-kit/core";
import type { Account } from "@ledgerhq/wallet-api-client";
import { Deferred, Effect, Fiber, Layer, Option, Stream } from "effect";
import type { Chain } from "viem";
import { mainnet, optimism } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { normalizeWidgetConfig } from "../../../src/app/config";
import { WidgetConfigService } from "../../../src/services/config/widget-config";
import { WidgetPersistence } from "../../../src/services/persistence/widget-persistence";
import { makeDefaultConfig } from "../../../src/services/wallet/default-wagmi-config";
import type {
  WalletCoreProjection,
  WalletRuntimeSnapshot,
} from "../../../src/services/wallet/domain/runtime";
import type { WalletController } from "../../../src/services/wallet/wagmi-config";
import {
  type WalletRuntimeAdapters,
  WalletService,
} from "../../../src/services/wallet/wallet-service";
import { makeCurrentValueStream } from "../../../src/shared/effect/current-value-stream";
import { makeRuntimeTestController } from "./runtime-test-controller";

const address = "0x0000000000000000000000000000000000000001";

const settings = normalizeWidgetConfig({
  apiKey: "api-key",
  disableInjectedProviderDiscovery: true,
  variant: "default",
});

const configLayer = WidgetConfigService.layer({
  changes: Stream.never,
  current: Effect.succeed(settings),
  initial: settings,
});

const persistenceLayer = Layer.succeed(
  WidgetPersistence,
  WidgetPersistence.of({
    getTosAccepted: Effect.succeed(false),
    readStoredPublicKeys: Effect.succeed({}),
    setTosAccepted: () => Effect.void,
    upsertStoredPublicKey: () => Effect.void,
  })
);

const disconnectedConnection = {
  address: undefined,
  addresses: undefined,
  chain: undefined,
  chainId: undefined,
  connector: undefined,
  isConnected: false,
  isConnecting: false,
  isDisconnected: true,
  isReconnecting: false,
  status: "disconnected",
} as const satisfies WalletCoreProjection["connection"];

const connectedConnection = (
  connector: Connector
): WalletCoreProjection["connection"] => ({
  address,
  addresses: [address],
  chain: mainnet,
  chainId: mainnet.id,
  connector,
  isConnected: true,
  isConnecting: false,
  isDisconnected: false,
  isReconnecting: false,
  status: "connected",
});

const makeRuntimeLayer = ({
  connection,
  connectors,
  controller,
}: {
  readonly connection: WalletCoreProjection["connection"];
  readonly connectors: ReadonlyArray<Connector>;
  readonly controller: WalletController;
}) => {
  const adapters = {
    environment: {
      getEnabledNetworks: () => Effect.succeed(new Set(["ethereum"])),
      getHref: () => "https://widget.test/",
      getInitialYield: () => Effect.die("unused"),
      isLedgerDappBrowser: () => false,
      isMobileWallet: () => false,
    },
    wagmi: {
      buildConfig: () => Effect.succeed(controller),
      getConnection: () => connection,
      getConnectors: () => connectors,
      initialize: () => Effect.void,
      watchConnection: () => () => undefined,
      watchConnectors: () => () => undefined,
    },
  } satisfies WalletRuntimeAdapters;

  return WalletService.layerWithRuntimeAdapters(adapters).pipe(
    Layer.provide(Layer.mergeAll(configLayer, persistenceLayer))
  );
};

const waitForReadyState = (
  wallet: WalletService["Service"],
  status: "connected" | "disconnected"
) =>
  wallet.changes.pipe(
    Stream.filter(
      (
        snapshot
      ): snapshot is Extract<WalletRuntimeSnapshot, { phase: "Ready" }> =>
        snapshot.phase === "Ready" &&
        snapshot.projection.state.status === status
    ),
    Stream.runHead,
    Effect.map(Option.getOrThrow)
  );

describe("WalletService canonical Wallet State", () => {
  it("publishes a connection only after its enrichment is complete", async () => {
    const enrichmentStarted = await Effect.runPromise(Deferred.make<void>());
    const enrichmentRelease = await Effect.runPromise(
      Deferred.make<ReadonlyArray<typeof optimism>>()
    );
    const connector = {
      $filteredChains: Stream.fromEffect(
        Effect.gen(function* () {
          yield* Deferred.succeed(enrichmentStarted, undefined);
          return yield* Deferred.await(enrichmentRelease);
        })
      ),
      id: "controlled",
      name: "Controlled",
      type: "controlled",
      uid: "controlled-uid",
    } as unknown as Connector;
    const wagmiConfig = makeDefaultConfig();
    const controller = {
      actions: {
        connect: () => Effect.void,
        disconnect: () => Effect.void,
        reconnect: () => Effect.void,
        sendEvmTransaction: () => Effect.die("unused"),
        signMessage: () => Effect.die("unused"),
        switchChain: () => Effect.die("unused"),
      },
      cosmosConfig: { cosmosChainsMap: {} },
      enabledNetworks: new Set(["ethereum"]),
      evmConfig: {
        evmChains: [mainnet],
        evmChainsMap: {
          ethereum: {
            skChainName: "ethereum",
            wagmiChain: mainnet,
          },
        },
      },
      isLedgerLive: false,
      miscConfig: { miscChainsMap: {} },
      queryParams: {},
      queryParamsInitChainId: undefined,
      substrateConfig: { substrateChainsMap: {} },
      wagmiConfig,
    } as unknown as WalletController;
    let currentConnection: WalletCoreProjection["connection"] =
      disconnectedConnection;
    let publishConnection: (
      connection: WalletCoreProjection["connection"]
    ) => void = () => undefined;
    const adapters = {
      environment: {
        getEnabledNetworks: () => Effect.succeed(new Set(["ethereum"])),
        getHref: () => "https://widget.test/?network=ethereum",
        getInitialYield: () => Effect.die("unused"),
        isLedgerDappBrowser: () => false,
        isMobileWallet: () => false,
      },
      wagmi: {
        buildConfig: () => Effect.succeed(controller),
        getConnection: () => currentConnection,
        getConnectors: () => [connector],
        initialize: () => Effect.void,
        watchConnection: (_config, onChange) => {
          publishConnection = onChange;
          return () => undefined;
        },
        watchConnectors: () => () => undefined,
      },
    } satisfies WalletRuntimeAdapters;
    const layer = WalletService.layerWithRuntimeAdapters(adapters).pipe(
      Layer.provide(Layer.mergeAll(configLayer, persistenceLayer))
    );

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const initial = yield* waitForReadyState(wallet, "disconnected");
          const connectedFiber = yield* waitForReadyState(
            wallet,
            "connected"
          ).pipe(Effect.forkChild({ startImmediately: true }));

          currentConnection = connectedConnection(connector);
          publishConnection(currentConnection);
          yield* Deferred.await(enrichmentStarted);

          const whileEnriching = yield* wallet.current;
          const stateWhileEnriching = wallet.getState();
          yield* Deferred.succeed(enrichmentRelease, [optimism]);
          const connected = yield* Fiber.join(connectedFiber);
          const connectedState = wallet.getState();

          return {
            connected,
            connectedState,
            initial,
            stateWhileEnriching,
            whileEnriching,
          };
        })
      ).pipe(Effect.provide(layer))
    );

    expect(result.initial.projection.state).toMatchObject({
      connectorChains: [mainnet],
      status: "disconnected",
    });
    expect(result.whileEnriching).toBe(result.initial);
    expect(result.stateWhileEnriching.status).toBe("disconnected");
    expect(result.connected.projection.state).toMatchObject({
      address,
      chain: mainnet,
      connector,
      connectorChains: [optimism],
      network: "ethereum",
      status: "connected",
    });
    expect(result.connectedState).toBe(result.connected.projection.state);
  });

  it("publishes and deduplicates complete Ledger state", async () => {
    const firstAccount = { id: "ledger-1" } as Account;
    const replacementAccount = { id: "ledger-2" } as Account;
    const accounts = makeCurrentValueStream([firstAccount]);
    const currentAccountId = makeCurrentValueStream<string | undefined>(
      firstAccount.id
    );
    const disabledChains = makeCurrentValueStream<Chain[]>([optimism]);
    const switchAccount = vi.fn();
    const connector = {
      $accountsOnCurrentChain: accounts.changes,
      $currentAccountId: currentAccountId.changes,
      $disabledChains: disabledChains.changes,
      $filteredChains: Stream.succeed([mainnet]),
      id: "ledgerLive",
      name: "Ledger Live",
      noAccountPlaceholder: address,
      switchAccount,
      type: "ledgerLive",
      uid: "ledger-uid",
    } as unknown as Connector;
    const controller = makeRuntimeTestController({
      actions: {},
      evmConfig: {
        evmChains: [mainnet],
        evmChainsMap: {
          ethereum: { skChainName: "ethereum", wagmiChain: mainnet },
        },
      },
      queryParamsInitChainId: undefined,
      wagmiConfig: makeDefaultConfig(),
    });
    const layer = makeRuntimeLayer({
      connection: connectedConnection(connector),
      connectors: [connector],
      controller,
    });

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const snapshotsFiber = yield* wallet.changes.pipe(
            Stream.filter(
              (
                snapshot
              ): snapshot is Extract<
                WalletRuntimeSnapshot,
                { phase: "Ready" }
              > => snapshot.phase === "Ready"
            ),
            Stream.take(2),
            Stream.runCollect,
            Effect.forkChild({ startImmediately: true })
          );
          const initial = yield* waitForReadyState(wallet, "connected");

          accounts.set([{ ...firstAccount }]);
          accounts.set([replacementAccount]);
          const snapshots = yield* Fiber.join(snapshotsFiber);
          yield* wallet.switchAccount({
            account: replacementAccount,
            connector,
          });

          return { initial, snapshots };
        })
      ).pipe(Effect.provide(layer))
    );

    expect(result.snapshots).toHaveLength(2);
    expect(result.initial.projection).toMatchObject({
      ledgerState: {
        accounts: [firstAccount],
        currentAccountId: firstAccount.id,
        disabledChains: [optimism],
      },
      state: {
        isLedgerLive: true,
        isLedgerLiveAccountPlaceholder: true,
        ledgerAccounts: [firstAccount],
      },
    });
    expect(result.snapshots[1]?.projection.state.ledgerAccounts).toEqual([
      replacementAccount,
    ]);
    expect(switchAccount).toHaveBeenCalledWith(replacementAccount);
  });

  it("keeps Cosmos routing private while publishing validated addresses", async () => {
    const cosmosChain = {
      ...mainnet,
      id: 118,
      name: "Cosmos Hub",
    } as Chain;
    const goodChainWallet = {
      chainId: "cosmoshub-4",
      client: {
        getAccount: async () => ({ pubkey: new Uint8Array([1, 2, 3]) }),
      },
    } as unknown as ChainWalletBase;
    const failingChainWallet = {
      chainId: "cosmoshub-4",
      client: {
        getAccount: async () => {
          throw new Error("public key unavailable");
        },
      },
    } as unknown as ChainWalletBase;
    const chainWallet = makeCurrentValueStream(goodChainWallet);
    const signTransaction = vi.fn(() => Effect.succeed("signed-cosmos-tx"));
    const connector = {
      $chainWallet: chainWallet.changes,
      $filteredChains: Stream.succeed([cosmosChain]),
      id: "cosmos",
      name: "Cosmos",
      signTransaction,
      toBase64: () => "A".repeat(44),
      type: "cosmosProvider",
      uid: "cosmos-uid",
    } as unknown as Connector;
    const connection = {
      ...connectedConnection(connector),
      address: "cosmos1wallet",
      addresses: ["cosmos1wallet"],
      chain: cosmosChain,
      chainId: cosmosChain.id,
    } as unknown as WalletCoreProjection["connection"];
    const controller = makeRuntimeTestController({
      actions: {},
      cosmosConfig: {
        cosmosChainsMap: {
          cosmos: { skChainName: "cosmos", wagmiChain: cosmosChain },
        },
      },
      queryParamsInitChainId: undefined,
      wagmiConfig: makeDefaultConfig(),
    });
    const layer = makeRuntimeLayer({
      connection,
      connectors: [connector],
      controller,
    });

    const result = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const wallet = yield* WalletService;
          const initial = yield* waitForReadyState(wallet, "connected");
          const degradedFiber = yield* wallet.changes.pipe(
            Stream.filter(
              (
                snapshot
              ): snapshot is Extract<
                WalletRuntimeSnapshot,
                { phase: "Ready" }
              > =>
                snapshot.phase === "Ready" &&
                snapshot.projection.state.status === "connected" &&
                snapshot.projection.state.additionalAddresses === null
            ),
            Stream.runHead,
            Effect.map(Option.getOrThrow),
            Effect.forkChild({ startImmediately: true })
          );

          chainWallet.set(failingChainWallet);
          const degraded = yield* Fiber.join(degradedFiber);
          const signed = yield* wallet.signTransaction({
            ledgerHwAppId: null,
            network: "cosmos",
            tx: "cosmos-tx",
            txMeta: {} as never,
          });

          return { degraded, initial, signed };
        })
      ).pipe(Effect.provide(layer))
    );

    expect(result.initial.projection.state.additionalAddresses).toEqual({
      cosmosPubKey: "A".repeat(44),
    });
    expect(result.initial.projection).not.toHaveProperty("cosmosChainWallet");
    expect(result.degraded.projection.state).toMatchObject({
      additionalAddresses: null,
      address: "cosmos1wallet",
      network: "cosmos",
      status: "connected",
    });
    expect(result.signed).toEqual({
      broadcasted: false,
      signedTx: "signed-cosmos-tx",
    });
    expect(signTransaction).toHaveBeenCalledWith({
      cw: failingChainWallet,
      tx: "cosmos-tx",
    });
  });

  it("degrades failed connector, Ledger, and Cosmos streams by slice", async () => {
    const ledgerConnector = {
      $accountsOnCurrentChain: Stream.fail(new Error("accounts failed")),
      $currentAccountId: Stream.fail(new Error("account id failed")),
      $disabledChains: Stream.fail(new Error("disabled chains failed")),
      $filteredChains: Stream.fail(new Error("chains failed")),
      id: "ledgerLive",
      name: "Ledger Live",
      noAccountPlaceholder: "0xplaceholder",
      type: "ledgerLive",
      uid: "ledger-failure-uid",
    } as unknown as Connector;
    const ledgerController = makeRuntimeTestController({
      actions: {},
      evmConfig: {
        evmChains: [mainnet],
        evmChainsMap: {
          ethereum: { skChainName: "ethereum", wagmiChain: mainnet },
        },
      },
      queryParamsInitChainId: undefined,
      wagmiConfig: makeDefaultConfig(),
    });
    const ledgerLayer = makeRuntimeLayer({
      connection: connectedConnection(ledgerConnector),
      connectors: [ledgerConnector],
      controller: ledgerController,
    });

    const ledger = await Effect.runPromise(
      Effect.scoped(
        WalletService.use((wallet) => waitForReadyState(wallet, "connected"))
      ).pipe(Effect.provide(ledgerLayer))
    );

    const cosmosChain = { ...mainnet, id: 118 } as Chain;
    const cosmosConnector = {
      $chainWallet: Stream.fail(new Error("chain wallet failed")),
      $filteredChains: Stream.succeed([cosmosChain]),
      id: "cosmos",
      name: "Cosmos",
      type: "cosmosProvider",
      uid: "cosmos-failure-uid",
    } as unknown as Connector;
    const cosmosController = makeRuntimeTestController({
      actions: {},
      cosmosConfig: {
        cosmosChainsMap: {
          cosmos: { skChainName: "cosmos", wagmiChain: cosmosChain },
        },
      },
      queryParamsInitChainId: undefined,
      wagmiConfig: makeDefaultConfig(),
    });
    const cosmosLayer = makeRuntimeLayer({
      connection: {
        ...connectedConnection(cosmosConnector),
        address: "cosmos1wallet",
        addresses: ["cosmos1wallet"],
        chain: cosmosChain,
        chainId: cosmosChain.id,
      } as unknown as WalletCoreProjection["connection"],
      connectors: [cosmosConnector],
      controller: cosmosController,
    });
    const cosmos = await Effect.runPromise(
      Effect.scoped(
        WalletService.use((wallet) => waitForReadyState(wallet, "connected"))
      ).pipe(Effect.provide(cosmosLayer))
    );

    expect(ledger.projection).toMatchObject({
      ledgerState: {
        accounts: [],
        currentAccountId: undefined,
        disabledChains: [],
      },
      state: {
        connectorChains: [mainnet],
        ledgerAccounts: [],
        status: "connected",
      },
    });
    expect(cosmos.projection.state).toMatchObject({
      additionalAddresses: null,
      network: "cosmos",
      status: "connected",
    });
  });
});
