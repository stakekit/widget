import type { Connection as SolanaConnection } from "@solana/web3.js";
import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { Connector, createConfig } from "wagmi";
import { AdditionalAddresses } from "../../src/domain/wallet/address";
import { EnabledWalletNetworksResponse } from "../../src/domain/wallet/models";
import { InitParams } from "../../src/services/wallet/init-params";
import { getConfig as getEvmConfig } from "../../src/services/wallet/internal/adapters/evm/config";
import {
  WagmiOperations,
  WagmiOperationsError,
  type WagmiOperationsService,
  wagmiOperations,
} from "../../src/services/wallet/internal/platform/wagmi-operations";
import {
  makeInitializeWallet,
  type WalletInitialConnectionInput,
} from "../../src/services/wallet/internal/runtime/initial-connection";
import { makeWagmiActions } from "../../src/services/wallet/internal/runtime/wagmi-actions";
import {
  buildWagmiConfig,
  getUnseenMipdProviders,
  scopedMipdSubscription,
} from "../../src/services/wallet/internal/runtime/wagmi-config";

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

type InitialConnectionOperations = Pick<
  WagmiOperationsService,
  "connect" | "reconnect" | "switchChain"
>;

const operationFailure = (cause: unknown) =>
  new WagmiOperationsError({ cause, operation: "reconnect" });

const makeInitializer = (operations: InitialConnectionOperations) =>
  Effect.runPromise(
    makeInitializeWallet.pipe(
      Effect.provideService(
        WagmiOperations,
        WagmiOperations.of({ ...wagmiOperations, ...operations })
      )
    )
  );

const initialize = async (
  operations: InitialConnectionOperations,
  input: Omit<
    WalletInitialConnectionInput,
    "isLedgerDappBrowser" | "isMobileWallet"
  > & {
    readonly isLedgerDappBrowser?: boolean;
    readonly isMobileWallet?: boolean;
  }
) => {
  const run = await makeInitializer(operations);
  return Effect.runPromise(
    run({
      ...input,
      isLedgerDappBrowser: input.isLedgerDappBrowser ?? false,
      isMobileWallet: input.isMobileWallet ?? false,
    })
  );
};

describe("wallet Effect Atom boundaries", () => {
  it("reconciles cumulative MIPD snapshots without duplicating providers", () => {
    const provider = (rdns: string) => ({ info: { rdns } });
    const configuredConnector = { id: "configured" };
    const firstSnapshot = [provider("wallet.a")];
    const firstNew = getUnseenMipdProviders({
      connectors: [configuredConnector],
      providers: firstSnapshot as never,
    });
    const connectorsAfterFirst = [
      configuredConnector,
      ...firstNew.map((details) => ({ id: details.info.rdns })),
    ];
    const secondNew = getUnseenMipdProviders({
      connectors: connectorsAfterFirst,
      providers: [provider("wallet.a"), provider("wallet.b")] as never,
    });
    const connectorsAfterSecond = [
      ...connectorsAfterFirst,
      ...secondNew.map((details) => ({ id: details.info.rdns })),
    ];

    expect(firstNew.map((details) => details.info.rdns)).toEqual(["wallet.a"]);
    expect(secondNew.map((details) => details.info.rdns)).toEqual(["wallet.b"]);
    expect(
      getUnseenMipdProviders({
        connectors: connectorsAfterSecond,
        providers: [provider("wallet.a"), provider("wallet.b")] as never,
      })
    ).toEqual([]);
    expect(connectorsAfterSecond.map((connector) => connector.id)).toEqual([
      "configured",
      "wallet.a",
      "wallet.b",
    ]);
  });

  it("decodes Yield network IDs into distinct Enabled Wallet Networks", () => {
    const networks = Schema.decodeUnknownSync(EnabledWalletNetworksResponse)([
      { id: "ethereum" },
      { id: "plume" },
      { id: "ethereum" },
    ]);

    expect(networks).toEqual(new Set(["ethereum"]));
  });

  it("accepts projects without Enabled Wallet Networks", () => {
    expect(Schema.decodeUnknownSync(EnabledWalletNetworksResponse)([])).toEqual(
      new Set()
    );
  });

  it("rejects unknown Yield network IDs", () => {
    expect(() =>
      Schema.decodeUnknownSync(EnabledWalletNetworksResponse)([
        { id: "not-a-network" },
      ])
    ).toThrow(/Expected Networks[\s\S]*at \[0\]\["id"\]/);
  });

  it("decodes valid initialization parameters and ignores invalid fields", () => {
    expect(
      Schema.decodeUnknownSync(InitParams)({
        ...emptyInitParams,
        network: "ethereum",
        pendingaction: "UNSTAKE",
        yieldId: "ethereum-eth-native-staking",
      })
    ).toMatchObject({
      network: "ethereum",
      pendingaction: "UNSTAKE",
      yieldId: "ethereum-eth-native-staking",
    });

    expect(
      Schema.decodeUnknownSync(InitParams)({
        ...emptyInitParams,
        network: "ethereum-holesky",
      })
    ).toMatchObject({ network: null });
    expect(
      Schema.decodeUnknownSync(InitParams)({
        ...emptyInitParams,
        pendingaction: "unstake",
      })
    ).toMatchObject({ pendingaction: null });
  });

  it("validates wallet-provided additional address data with Schema", () => {
    const cosmosPubKey = "A".repeat(44);

    expect(
      Schema.decodeUnknownSync(AdditionalAddresses)({ cosmosPubKey })
    ).toEqual({ cosmosPubKey });
    expect(() =>
      Schema.decodeUnknownSync(AdditionalAddresses)({ cosmosPubKey: "short" })
    ).toThrow();
  });

  it("constructs EVM configuration directly from validated networks", async () => {
    const config = await Effect.runPromise(
      getEvmConfig({
        enabledNetworks: new Set(["ethereum"]),
        forceWalletConnectOnly: true,
        institutionalWallets: false,
        variant: "default",
      })
    );

    expect(config.evmChains).toHaveLength(1);
    expect(config.evmChainsMap.ethereum?.network).toBe("ethereum");
  });

  it("runs reconnect, mobile fallback, and requested chain switching in order", async () => {
    const calls: string[] = [];
    const injectedConnector = { id: "injected" } as Connector;
    const wagmiConfig = {
      connectors: [injectedConnector],
      state: { chainId: 1 },
    } as unknown as ReturnType<typeof createConfig>;
    const operations: InitialConnectionOperations = {
      reconnect: vi.fn(() =>
        Effect.sync(() => {
          calls.push("reconnect");
          return [];
        })
      ),
      connect: vi.fn(() =>
        Effect.sync(() => {
          calls.push("connect");
          return { accounts: [], chainId: 1 };
        })
      ),
      switchChain: vi.fn(() =>
        Effect.sync(() => {
          calls.push("switch");
          return { id: 2 };
        })
      ),
    };

    await Effect.runPromise(
      (await makeInitializer(operations))({
        hasExternalProvider: false,
        isLedgerDappBrowser: false,
        isMobileWallet: true,
        queryParamsInitChainId: 2,
        wagmiConfig,
      })
    );

    expect(calls).toEqual(["reconnect", "connect", "switch"]);
    expect(operations.reconnect).toHaveBeenCalledOnce();
    expect(operations.connect).toHaveBeenCalledOnce();
    expect(operations.switchChain).toHaveBeenCalledOnce();
  });

  it("continues after reconnect, fallback connect, and initial switch failures", async () => {
    const injectedConnector = { id: "injected" } as Connector;
    const wagmiConfig = {
      connectors: [injectedConnector],
      state: { chainId: 1 },
    } as unknown as ReturnType<typeof createConfig>;
    const cause = new Error("initialization failed");
    const baseOperations: InitialConnectionOperations = {
      connect: vi.fn(() => Effect.succeed({ accounts: [], chainId: 1 })),
      reconnect: vi.fn(() => Effect.succeed([{} as never])),
      switchChain: vi.fn(() => Effect.succeed({ id: 2 })),
    };
    const run = (
      operations: InitialConnectionOperations,
      isMobileWallet = false
    ) =>
      initialize(operations, {
        hasExternalProvider: false,
        isMobileWallet,
        queryParamsInitChainId: 2,
        wagmiConfig,
      });

    const reconnectFailure = vi.fn(() => Effect.fail(operationFailure(cause)));
    const reconnectConnect = vi.fn(() =>
      Effect.succeed({ accounts: [], chainId: 1 })
    );
    const reconnectSwitch = vi.fn(() => Effect.succeed({ id: 2 }));
    await run(
      {
        ...baseOperations,
        connect: reconnectConnect,
        reconnect: reconnectFailure,
        switchChain: reconnectSwitch,
      },
      true
    );
    const fallbackConnectFailure = vi.fn(() =>
      Effect.fail(operationFailure(cause))
    );
    await run(
      {
        ...baseOperations,
        connect: fallbackConnectFailure,
        reconnect: vi.fn(() => Effect.succeed([])),
      },
      true
    );
    const switchFailure = vi.fn(() => Effect.fail(operationFailure(cause)));
    await run({
      ...baseOperations,
      switchChain: switchFailure,
    });

    expect(reconnectFailure).toHaveBeenCalledOnce();
    expect(reconnectSwitch).toHaveBeenCalledOnce();
    expect(reconnectConnect).toHaveBeenCalledOnce();
    expect(reconnectConnect).toHaveBeenCalledWith(wagmiConfig, {
      chainId: 2,
      connector: injectedConnector,
    });
    expect(fallbackConnectFailure).toHaveBeenCalledOnce();
    expect(switchFailure).toHaveBeenCalledOnce();
  });

  it("retains configured connectors and manual connect after initial switching fails", async () => {
    const configuredConnector = { id: "configured" } as Connector;
    const wagmiConfig = {
      connectors: [configuredConnector],
      state: { chainId: 1 },
    } as unknown as ReturnType<typeof createConfig>;
    const connect = vi.fn(() => Effect.succeed({ accounts: [], chainId: 1 }));
    const operations: InitialConnectionOperations = {
      connect,
      reconnect: vi.fn(() => Effect.succeed([{} as never])),
      switchChain: vi.fn(() =>
        Effect.fail(operationFailure(new Error("switch rejected")))
      ),
    };

    await Effect.runPromise(
      (await makeInitializer(operations))({
        hasExternalProvider: false,
        isLedgerDappBrowser: false,
        isMobileWallet: false,
        queryParamsInitChainId: 2,
        wagmiConfig,
      })
    );

    expect(wagmiConfig.connectors).toEqual([configuredConnector]);

    await Effect.runPromise(
      operations.connect(wagmiConfig, { connector: configuredConnector })
    );
    expect(connect).toHaveBeenCalledOnce();
  });

  it("keeps wallet configuration construction failures fatal", async () => {
    const cause = new Error("connector construction failed");
    await expect(
      Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const buildActions = yield* makeWagmiActions;
            return yield* buildWagmiConfig(
              {
                chainIconMapping: undefined,
                customConnectors: () => {
                  throw cause;
                },
                disableInjectedProviderDiscovery: true,
                enabledNetworks: new Set(["ethereum"]),
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
              },
              buildActions
            );
          }).pipe(Effect.provide(WagmiOperations.layer))
        )
      )
    ).rejects.toThrow(cause.message);
  });

  it("builds an empty wallet topology when no Wallet Networks are enabled", async () => {
    const customConnectors = vi.fn(() => {
      throw new Error("must not build connectors without Wallet Networks");
    });
    const controller = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const buildActions = yield* makeWagmiActions;
          return yield* buildWagmiConfig(
            {
              chainIconMapping: undefined,
              customConnectors,
              disableInjectedProviderDiscovery: true,
              enabledNetworks: new Set(),
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
            },
            buildActions
          );
        }).pipe(Effect.provide(WagmiOperations.layer))
      )
    );

    expect(controller.enabledNetworks).toEqual(new Set());
    expect(controller.evmConfig.evmChains).toEqual([]);
    expect(controller.cosmosConfig.cosmosWagmiChains).toEqual([]);
    expect(controller.miscConfig.miscChains).toEqual([]);
    expect(controller.substrateConfig.substrateChains).toEqual([]);
    expect(controller.wagmiConfig.connectors).toEqual([]);
    expect(customConnectors).not.toHaveBeenCalled();
  });

  it("disposes MIPD ownership and ignores callbacks from the released scope", async () => {
    const publish = vi.fn();
    const unsubscribe = vi.fn();
    let publishAfterRelease: (() => void) | undefined;

    await Effect.runPromise(
      Effect.scoped(
        scopedMipdSubscription({
          initialProviders: [],
          publish,
          subscribe: (onProviders) => {
            publishAfterRelease = () => onProviders([]);
            return unsubscribe;
          },
        })
      )
    );

    expect(publish).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();

    publishAfterRelease?.();
    expect(publish).toHaveBeenCalledOnce();
  });
});
