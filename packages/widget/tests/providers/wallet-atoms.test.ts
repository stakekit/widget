import type { Connection } from "@solana/web3.js";
import { Effect, Schema } from "effect";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Connector, createConfig } from "wagmi";
import { AdditionalAddresses } from "../../src/domain/schema/address-models";
import {
  EnabledNetworksResponse,
  WalletInitQueryParams,
} from "../../src/domain/schema/wallet-models";
import type { SKExternalProviders } from "../../src/domain/types/wallets";
import { getConfig as getEvmConfig } from "../../src/providers/ethereum/config";
import {
  initializeWallet,
  scopedMipdSubscription,
  WalletInitializationKey,
  type WalletInitializationOperations,
  walletControllerAtom,
} from "../../src/providers/wallet";

const emptyInitQueryParams = {
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

  it("strictly validates initialization parameters before wallet construction", () => {
    expect(
      Schema.decodeUnknownSync(WalletInitQueryParams)({
        ...emptyInitQueryParams,
        network: "ethereum",
        pendingaction: "UNSTAKE",
        yieldId: "ethereum-eth-native-staking",
      })
    ).toMatchObject({
      network: "ethereum",
      pendingaction: "UNSTAKE",
      yieldId: "ethereum-eth-native-staking",
    });

    expect(() =>
      Schema.decodeUnknownSync(WalletInitQueryParams)({
        ...emptyInitQueryParams,
        network: "ethereum-holesky",
      })
    ).toThrow("widget-supported network");
    expect(() =>
      Schema.decodeUnknownSync(WalletInitQueryParams)({
        ...emptyInitQueryParams,
        pendingaction: "unstake",
      })
    ).toThrow();
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

  it("maps reconnect, fallback connect, and initial switch failures to typed phases", async () => {
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
    const readError = (operations: WalletInitializationOperations) =>
      Effect.runPromise(
        Effect.flip(
          initializeWallet({
            hasExternalProvider: false,
            operations,
            queryParamsInitChainId: 2,
            wagmiConfig,
          })
        )
      );

    const reconnectError = await readError({
      ...baseOperations,
      reconnect: vi.fn(async () => {
        throw cause;
      }),
    });
    const fallbackError = await readError({
      ...baseOperations,
      connect: vi.fn(async () => {
        throw cause;
      }),
      isMobile: () => true,
      reconnect: vi.fn(async () => []),
    });
    const switchError = await readError({
      ...baseOperations,
      switchChain: vi.fn(async () => {
        throw cause;
      }),
    });

    expect(reconnectError).toMatchObject({
      _tag: "WalletInitializationError",
      cause,
      phase: "reconnect",
    });
    expect(fallbackError).toMatchObject({
      _tag: "WalletInitializationError",
      cause,
      phase: "mobile-fallback-connect",
    });
    expect(switchError).toMatchObject({
      _tag: "WalletInitializationError",
      cause,
      phase: "initial-chain-switch",
    });
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
