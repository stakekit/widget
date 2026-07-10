import type { Connection } from "@solana/web3.js";
import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { Connector, createConfig } from "wagmi";
import { AdditionalAddresses } from "../../src/domain/schema/address-models";
import {
  EnabledNetworksResponse,
  WalletInitQueryParams,
} from "../../src/domain/schema/wallet-models";
import { getConfig as getEvmConfig } from "../../src/providers/ethereum/config";
import {
  initializeWallet,
  WalletInitializationKey,
  type WalletInitializationOperations,
  walletInitializationAtom,
  withWalletLifecycleCleanup,
} from "../../src/providers/wagmi";

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
    const result = await getEvmConfig({
      enabledNetworks: new Set(["ethereum"]),
      forceWalletConnectOnly: true,
      institutionalWallets: false,
      variant: "default",
    }).run();
    const config = result.unsafeCoerce();

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
      }),
      switchChain: vi.fn(async () => {
        calls.push("switch");
      }),
      isLedgerLive: () => false,
      isMobile: () => true,
    };

    await Effect.runPromise(
      initializeWallet({
        externalProviders: undefined,
        operations,
        queryParamsInitChainId: 2,
        wagmiConfig,
      })
    );

    expect(calls).toEqual(["reconnect", "connect", "switch"]);
  });

  it("deduplicates equivalent lifecycle keys and replaces changed keys", () => {
    const solanaConnection = {} as Connection;
    const fields = {
      chainIconMapping: undefined,
      disableInjectedProviderDiscovery: true,
      externalProvidersValue: undefined,
      forceWalletConnectOnly: false,
      institutionalWallets: false,
      isLedgerLive: false,
      isSafe: false,
      solanaConnection,
      solanaWallets: [],
      tonConnectManifestUrl: undefined,
      variant: "default" as const,
    };
    const first = walletInitializationAtom(new WalletInitializationKey(fields));
    const equivalent = walletInitializationAtom(
      new WalletInitializationKey({ ...fields })
    );
    const changed = walletInitializationAtom(
      new WalletInitializationKey({
        ...fields,
        forceWalletConnectOnly: true,
      })
    );

    expect(equivalent).toBe(first);
    expect(changed).not.toBe(first);
    expect(first.idleTTL).toBe(0);
  });

  it("runs lifecycle cleanup when the owning Effect scope is replaced", async () => {
    const cleanup = vi.fn();

    await Effect.runPromise(
      Effect.scoped(
        withWalletLifecycleCleanup(Effect.succeed({ cleanup, value: 1 }))
      )
    );

    expect(cleanup).toHaveBeenCalledOnce();
  });
});
