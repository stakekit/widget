import type { Connection } from "@solana/web3.js";
import { Effect, Schema } from "effect";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Connector, createConfig } from "wagmi";
import { AdditionalAddresses } from "../../src/domain/schema/address-models";
import { InitParams } from "../../src/domain/schema/init-params";
import { EnabledNetworksResponse } from "../../src/domain/schema/wallet-models";
import {
  initializeWallet,
  scopedMipdSubscription,
  WalletInitializationKey,
  type WalletInitializationOperations,
  walletControllerAtom,
} from "../../src/features/wallet";
import type { SKExternalProviders } from "../../src/public-api/types";
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

  it("deduplicates equivalent lifecycle keys and replaces changed keys", () => {
    const solanaConnection = {} as Connection;
    const fields = {
      chainIconMapping: undefined,
      disableInjectedProviderDiscovery: true,
      externalProviderInitToken: null,
      forceWalletConnectOnly: false,
      hasExternalProvider: false,
      institutionalWallets: false,
      isLedgerLive: false,
      isSafe: false,
      solanaConnection,
      solanaWallets: [],
      tonConnectManifestUrl: undefined,
      variant: "default" as const,
    };
    const first = walletControllerAtom(new WalletInitializationKey(fields));
    const equivalent = walletControllerAtom(
      new WalletInitializationKey({ ...fields })
    );
    const changed = walletControllerAtom(
      new WalletInitializationKey({
        ...fields,
        forceWalletConnectOnly: true,
      })
    );

    expect(equivalent).toBe(first);
    expect(walletControllerAtom(new WalletInitializationKey(fields))).toBe(
      first
    );
    expect(changed).not.toBe(first);
    expect(first.idleTTL).toBe(0);
  });

  it("keeps dynamic external-provider changes out of config identity", () => {
    const externalProvidersRef: RefObject<SKExternalProviders> = {
      current: {
        currentAddress: "0x0000000000000000000000000000000000000001",
        currentChain: 1,
        initToken: "ethereum-eth",
        provider: {
          sendTransaction: vi.fn(async () => "first-hash"),
          signMessage: vi.fn(async () => "first-signature"),
          switchChain: vi.fn(async () => undefined),
        },
        supportedChainIds: [1],
        type: "generic",
      },
    };
    const fields = {
      chainIconMapping: undefined,
      disableInjectedProviderDiscovery: true,
      externalProviderInitToken: "ethereum-eth",
      externalProviders: externalProvidersRef,
      forceWalletConnectOnly: false,
      hasExternalProvider: true,
      institutionalWallets: false,
      isLedgerLive: false,
      isSafe: false,
      solanaConnection: {} as Connection,
      solanaWallets: [],
      tonConnectManifestUrl: undefined,
      variant: "default" as const,
    };
    const first = walletControllerAtom(new WalletInitializationKey(fields));

    externalProvidersRef.current = {
      ...externalProvidersRef.current,
      currentAddress: "0x0000000000000000000000000000000000000002",
      currentChain: 10,
      provider: {
        sendTransaction: vi.fn(async () => "replacement-hash"),
        signMessage: vi.fn(async () => "replacement-signature"),
        switchChain: vi.fn(async () => undefined),
      },
      supportedChainIds: [10],
    };

    const dynamicUpdate = walletControllerAtom(
      new WalletInitializationKey({ ...fields })
    );
    const topologyUpdate = walletControllerAtom(
      new WalletInitializationKey({
        ...fields,
        externalProviderInitToken: "polygon-matic",
      })
    );

    expect(dynamicUpdate).toBe(first);
    expect(topologyUpdate).not.toBe(first);
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
