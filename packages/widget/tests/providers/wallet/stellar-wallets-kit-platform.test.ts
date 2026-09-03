import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Fiber } from "effect";
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
  it.effect(
    "restores Freighter by reading its live account without prompting",
    () =>
      Effect.gen(function* () {
        const module = makeModule();
        const client = makeDirectStellarWalletClient({
          id: "freighter",
          installed: true,
          module,
          validateMainnet: true,
        });

        expect(yield* client.reconnect(address)).toEqual({ address });
        expect(module.getAddress).toHaveBeenCalledWith({
          skipRequestAccess: true,
        });
        expect(module.getNetwork).toHaveBeenCalledOnce();
      })
  );

  it.effect("rejects Freighter when it reports a non-mainnet network", () =>
    Effect.gen(function* () {
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

      expect(yield* Effect.flip(client.connect)).toMatchObject({
        _tag: "WalletIntegrationError",
        operation: "stellar-read-network",
      });
    })
  );

  it.effect("restores a matching live WalletConnect mainnet session", () =>
    Effect.gen(function* () {
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
                accounts: [
                  "eip155:1:0x0000000000000000000000000000000000000000",
                ],
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

      expect(yield* client.reconnect(address)).toEqual({ address });
      expect(sessionPaths.value).toEqual([
        { publicKey: address, topic: "session-topic" },
      ]);
    })
  );

  it.live("rejects malformed WalletConnect availability results", () =>
    Effect.gen(function* () {
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

      const result = yield* Effect.flip(client.connect).pipe(Effect.forkChild);
      yield* Effect.promise(() => vi.runAllTimersAsync());

      expect(yield* Fiber.join(result)).toMatchObject({
        _tag: "WalletIntegrationError",
        operation: "stellar-read-availability",
      });
      vi.useRealTimers();
    })
  );

  it.live("rejects an expired WalletConnect session", () =>
    Effect.gen(function* () {
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

      expect(yield* Effect.flip(client.reconnect(address))).toMatchObject({
        _tag: "WalletIntegrationError",
        operation: "stellar-reconnect",
      });
      expect(sessionPaths.value).toEqual([]);
    })
  );
});
