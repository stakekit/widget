import type { Connection } from "@solana/web3.js";
import { Effect, Fiber, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { Connector, createConfig } from "wagmi";
import { AdditionalAddresses } from "../../src/domain/schema/address-models";
import { InitParams } from "../../src/domain/schema/init-params";
import { EnabledNetworksResponse } from "../../src/domain/schema/wallet-models";
import {
  initializeWallet,
  scopedMipdSubscription,
  type WalletInitializationOperations,
} from "../../src/features/wallet";
import { getConfig as getEvmConfig } from "../../src/services/wallet/connectors/ethereum/config";
import { buildWagmiConfig } from "../../src/services/wallet/wagmi-config";

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

describe("wallet Effect Atom boundaries", () => {
  it("decodes enabled networks into a validated set and rejects unknown values", () => {
    const networks = Schema.decodeUnknownSync(EnabledNetworksResponse)([
      "ethereum",
      "cosmos",
      "ethereum",
    ]);

    expect(networks).toEqual(new Set(["ethereum", "cosmos"]));
    expect(() =>
      Schema.decodeUnknownSync(EnabledNetworksResponse)([
        "ethereum",
        "not-a-network",
      ])
    ).toThrow("not-a-network");
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
    expect(config.evmChainsMap.ethereum?.skChainName).toBe("ethereum");
  });

  it("runs reconnect, mobile fallback, and requested chain switching in order", async () => {
    const calls: string[] = [];
    const injectedConnector = { id: "injected" } as Connector;
    const wagmiConfig = {
      connectors: [injectedConnector],
      state: { chainId: 1 },
    } as unknown as ReturnType<typeof createConfig>;
    const operations: WalletInitializationOperations = {
      reconnect: vi.fn(async () => {
        calls.push("reconnect");
        return [];
      }),
      connect: vi.fn(async () => {
        calls.push("connect");
        return { accounts: [], chainId: 1 };
      }),
      switchChain: vi.fn(async () => {
        calls.push("switch");
        return { id: 2 };
      }),
      isLedgerLive: () => false,
      isMobile: () => true,
    };

    await Effect.runPromise(
      initializeWallet({
        hasExternalProvider: false,
        operations,
        queryParamsInitChainId: 2,
        wagmiConfig,
      })
    );

    expect(calls).toEqual(["reconnect", "connect", "switch"]);
    expect(operations.reconnect).toHaveBeenCalledOnce();
    expect(operations.connect).toHaveBeenCalledOnce();
    expect(operations.switchChain).toHaveBeenCalledOnce();
  });

  it("does not start a queued reconnect after its initializer is interrupted", async () => {
    const wagmiConfig = {
      connectors: [],
      state: { chainId: 1 },
    } as unknown as ReturnType<typeof createConfig>;
    let markFirstStarted: () => void = () => undefined;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    let releaseFirst: () => void = () => undefined;
    const firstResult = new Promise<[]>((resolve) => {
      releaseFirst = () => resolve([]);
    });
    const secondReconnect = vi.fn(async () => []);
    const baseOperations = {
      connect: vi.fn(async () => ({ accounts: [], chainId: 1 })),
      isLedgerLive: () => false,
      isMobile: () => false,
      switchChain: vi.fn(async () => ({ id: 1 })),
    } satisfies Omit<WalletInitializationOperations, "reconnect">;
    const firstFiber = Effect.runFork(
      initializeWallet({
        hasExternalProvider: false,
        operations: {
          ...baseOperations,
          reconnect: async () => {
            markFirstStarted();
            return firstResult;
          },
        },
        queryParamsInitChainId: undefined,
        wagmiConfig,
      })
    );
    await firstStarted;
    const secondFiber = Effect.runFork(
      initializeWallet({
        hasExternalProvider: false,
        operations: { ...baseOperations, reconnect: secondReconnect },
        queryParamsInitChainId: undefined,
        wagmiConfig,
      })
    );
    await Promise.resolve();

    await Effect.runPromise(Fiber.interrupt(secondFiber));
    releaseFirst();
    await Effect.runPromise(Fiber.join(firstFiber));
    await Promise.resolve();

    expect(secondReconnect).not.toHaveBeenCalled();
  });

  it("continues after reconnect, fallback connect, and initial switch failures", async () => {
    const injectedConnector = { id: "injected" } as Connector;
    const wagmiConfig = {
      connectors: [injectedConnector],
      state: { chainId: 1 },
    } as unknown as ReturnType<typeof createConfig>;
    const cause = new Error("initialization failed");
    const baseOperations: WalletInitializationOperations = {
      connect: vi.fn(async () => ({ accounts: [], chainId: 1 })),
      isLedgerLive: () => false,
      isMobile: () => false,
      reconnect: vi.fn(async () => [{} as never]),
      switchChain: vi.fn(async () => ({ id: 2 })),
    };
    const initialize = (operations: WalletInitializationOperations) =>
      Effect.runPromise(
        initializeWallet({
          hasExternalProvider: false,
          operations,
          queryParamsInitChainId: 2,
          wagmiConfig,
        })
      );

    const reconnectFailure = vi.fn(async () => {
      throw cause;
    });
    const reconnectConnect = vi.fn(async () => ({ accounts: [], chainId: 1 }));
    const reconnectSwitch = vi.fn(async () => ({ id: 2 }));
    await initialize({
      ...baseOperations,
      connect: reconnectConnect,
      isMobile: () => true,
      reconnect: reconnectFailure,
      switchChain: reconnectSwitch,
    });
    const fallbackConnectFailure = vi.fn(async () => {
      throw cause;
    });
    await initialize({
      ...baseOperations,
      connect: fallbackConnectFailure,
      isMobile: () => true,
      reconnect: vi.fn(async () => []),
    });
    const switchFailure = vi.fn(async () => {
      throw cause;
    });
    await initialize({
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
    const connect = vi.fn(async () => ({ accounts: [], chainId: 1 }));
    const operations: WalletInitializationOperations = {
      connect,
      isLedgerLive: () => false,
      isMobile: () => false,
      reconnect: vi.fn(async () => [{} as never]),
      switchChain: vi.fn(async () => {
        throw new Error("switch rejected");
      }),
    };

    await Effect.runPromise(
      initializeWallet({
        hasExternalProvider: false,
        operations,
        queryParamsInitChainId: 2,
        wagmiConfig,
      })
    );

    expect(wagmiConfig.connectors).toEqual([configuredConnector]);

    await operations.connect(wagmiConfig, {
      connector: configuredConnector,
    });
    expect(connect).toHaveBeenCalledOnce();
  });

  it("keeps wallet configuration construction failures fatal", async () => {
    const cause = new Error("connector construction failed");
    await expect(
      Effect.runPromise(
        Effect.scoped(
          buildWagmiConfig({
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
            persistPublicKey: async () => undefined,
            queryParams: Schema.decodeSync(InitParams)(emptyInitParams),
            solanaConnection: {} as Connection,
            solanaWallets: [],
            tonConnectManifestUrl: undefined,
            variant: "default",
          })
        )
      )
    ).rejects.toThrow(cause.message);
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
