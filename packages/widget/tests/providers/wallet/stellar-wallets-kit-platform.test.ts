import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import {
  makeDirectStellarWalletClient,
  makeWalletConnectStellarWalletClient,
  type StellarWalletModule,
} from "../../../src/services/wallet/internal/platform/stellar-wallets-kit-platform";

const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const publicNetworkPassphrase =
  "Public Global Stellar Network ; September 2015";

const makeModule = (
  overrides: Partial<StellarWalletModule> = {}
): StellarWalletModule => ({
  disconnect: undefined,
  getAddress: vi.fn(async () => ({ address })),
  getNetwork: vi.fn(async () => ({
    network: "PUBLIC",
    networkPassphrase: publicNetworkPassphrase,
  })),
  isAvailable: vi.fn(async () => true),
  productIcon: "https://example.com/wallet.png",
  productId: "freighter",
  productName: "Freighter",
  productUrl: "https://example.com/wallet",
  signTransaction: vi.fn(async () => ({ signedTxXdr: "signed-xdr" })),
  ...overrides,
});

describe("Stellar Wallets Kit platform", () => {
  it("restores Freighter by reading its live account without prompting", async () => {
    const module = makeModule();
    const client = makeDirectStellarWalletClient({
      id: "freighter",
      installed: true,
      module,
      validateMainnet: true,
    });

    await expect(Effect.runPromise(client.reconnect(address))).resolves.toEqual(
      { address }
    );
    expect(module.getAddress).toHaveBeenCalledWith({
      skipRequestAccess: true,
    });
    expect(module.getNetwork).toHaveBeenCalledOnce();
  });

  it("rejects Freighter when it reports a non-mainnet network", async () => {
    const module = makeModule({
      getNetwork: vi.fn(async () => ({
        network: "TESTNET",
        networkPassphrase: "Test SDF Network ; September 2015",
      })),
    });
    const client = makeDirectStellarWalletClient({
      id: "freighter",
      installed: true,
      module,
      validateMainnet: true,
    });

    await expect(
      Effect.runPromise(Effect.flip(client.connect))
    ).resolves.toMatchObject({
      _tag: "WalletIntegrationError",
      operation: "stellar-read-network",
    });
  });

  it("restores a matching live WalletConnect mainnet session", async () => {
    const sessionPaths = {
      value: [] as { publicKey: string; topic: string }[],
    };
    const module = {
      ...makeModule({ productId: "wallet_connect" }),
      getSessions: vi.fn(async () => [
        {
          expiry: 4_102_444_800,
          namespaces: {
            eip155: {
              accounts: ["eip155:1:0x0000000000000000000000000000000000000000"],
              methods: ["eth_sendTransaction"],
            },
          },
          topic: "unrelated-session-topic",
        },
        {
          expiry: 4_102_444_800,
          namespaces: {
            stellar: {
              accounts: [`stellar:pubnet:${address}`],
              methods: ["stellar_signXDR"],
            },
          },
          topic: "session-topic",
        },
      ]),
    };
    const client = makeWalletConnectStellarWalletClient({
      module,
      sessionPaths,
    });

    await expect(Effect.runPromise(client.reconnect(address))).resolves.toEqual(
      { address }
    );
    expect(sessionPaths.value).toEqual([
      { publicKey: address, topic: "session-topic" },
    ]);
  });

  it("rejects malformed WalletConnect availability results", async () => {
    vi.useFakeTimers();
    const sessionPaths = {
      value: [] as { publicKey: string; topic: string }[],
    };
    const module = {
      ...makeModule({
        isAvailable: vi.fn(async () => "available" as unknown as boolean),
        productId: "wallet_connect",
      }),
      getSessions: vi.fn(async () => []),
    };
    const client = makeWalletConnectStellarWalletClient({
      module,
      sessionPaths,
    });

    const result = Effect.runPromise(Effect.flip(client.connect));
    await vi.runAllTimersAsync();

    await expect(result).resolves.toMatchObject({
      _tag: "WalletIntegrationError",
      operation: "stellar-read-availability",
    });
    vi.useRealTimers();
  });

  it("rejects an expired WalletConnect session", async () => {
    const sessionPaths = {
      value: [] as { publicKey: string; topic: string }[],
    };
    const module = {
      ...makeModule({ productId: "wallet_connect" }),
      getSessions: vi.fn(async () => [
        {
          expiry: 1,
          namespaces: {
            stellar: {
              accounts: [`stellar:pubnet:${address}`],
              methods: ["stellar_signXDR"],
            },
          },
          topic: "expired-topic",
        },
      ]),
    };
    const client = makeWalletConnectStellarWalletClient({
      module,
      sessionPaths,
    });

    await expect(
      Effect.runPromise(Effect.flip(client.reconnect(address)))
    ).resolves.toMatchObject({
      _tag: "WalletIntegrationError",
      operation: "stellar-reconnect",
    });
    expect(sessionPaths.value).toEqual([]);
  });
});
