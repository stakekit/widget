import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { mainnet } from "viem/chains";
import type { Connector } from "wagmi";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { TrackingService } from "../../../src/services/tracking/tracking-service";
import { makeWalletLifecyclePolicy } from "../../../src/services/wallet/internal/runtime/lifecycle";
import type { NormalizedWalletState } from "../../../src/services/wallet/wallet-state";
import { disconnectedNormalizedWalletState } from "../../../src/services/wallet/wallet-state";

const firstAddress = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const secondAddress = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000002"
);
const connector = {
  id: "test",
  name: "Test",
  type: "test",
  uid: "test-uid",
} as unknown as Connector;

const connected = (
  address: WalletAddress = firstAddress
): Extract<NormalizedWalletState, { readonly status: "connected" }> => ({
  additionalAddresses: null,
  address,
  chain: mainnet,
  connector,
  connectorChains: [mainnet],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum" as const,
  status: "connected" as const,
});

const unsupported: NormalizedWalletState = {
  ...disconnectedNormalizedWalletState,
  address: firstAddress,
  chain: mainnet,
  connector,
  connectorChains: [mainnet],
  status: "unsupported" as const,
};

const makePolicy = (trackEvent: TrackingService["Service"]["trackEvent"]) =>
  makeWalletLifecyclePolicy.pipe(
    Effect.provide(
      Layer.succeed(
        TrackingService,
        TrackingService.of({ trackEvent } as TrackingService["Service"])
      )
    )
  );

describe("Wallet lifecycle policy", () => {
  it.effect("tracks each connected wallet identity once", () =>
    Effect.gen(function* () {
      const trackEvent = vi.fn(() => Effect.void);
      const disconnect = vi.fn(() => Effect.void);

      yield* Effect.gen(function* () {
        const policy = yield* makePolicy(trackEvent as never);
        yield* policy.transition({
          actions: { disconnect },
          state: connected(),
        });
        yield* policy.transition({
          actions: { disconnect },
          state: connected(),
        });
        yield* policy.transition({
          actions: { disconnect },
          state: connected(secondAddress),
        });
      });

      expect(trackEvent).toHaveBeenCalledTimes(2);
      expect(trackEvent).toHaveBeenLastCalledWith("connectedWallet", {
        address: secondAddress,
        network: "ethereum",
      });
      expect(disconnect).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "preserves the tracked identity through a connecting transition",
    () =>
      Effect.gen(function* () {
        const trackEvent = vi.fn(() => Effect.void);
        const disconnect = vi.fn(() => Effect.void);

        yield* Effect.gen(function* () {
          const policy = yield* makePolicy(trackEvent as never);
          yield* policy.transition({
            actions: { disconnect },
            state: connected(),
          });
          yield* policy.transition({
            actions: { disconnect },
            state: {
              ...disconnectedNormalizedWalletState,
              connectorChains: [mainnet],
              status: "connecting",
            },
          });
          yield* policy.transition({
            actions: { disconnect },
            state: connected(),
          });
        });

        expect(trackEvent).toHaveBeenCalledTimes(1);
        expect(disconnect).not.toHaveBeenCalled();
      })
  );

  it.effect("tracks Stellar wallet connections with address and network", () =>
    Effect.gen(function* () {
      const trackEvent = vi.fn(() => Effect.void);
      const stellarAddress = yield* Schema.decodeEffect(WalletAddress)(
        `G${"A".repeat(55)}`
      );
      const stellarConnector = {
        id: "freighter",
        name: "Freighter",
        type: "stellar-wallet",
        uid: "freighter-uid",
      } as unknown as Connector;

      yield* Effect.gen(function* () {
        const policy = yield* makePolicy(trackEvent as never);
        yield* policy.transition({
          actions: { disconnect: () => Effect.void },
          state: {
            ...connected(stellarAddress),
            connector: stellarConnector,
            network: "stellar",
          },
        });
      });

      expect(trackEvent).toHaveBeenCalledWith("connectedWallet", {
        address: stellarAddress,
        network: "stellar",
      });
    })
  );

  it.effect("disconnects an unsupported identity once until state resets", () =>
    Effect.gen(function* () {
      const disconnect = vi.fn(() => Effect.void);

      yield* Effect.gen(function* () {
        const policy = yield* makePolicy(() => Effect.void);
        yield* policy.transition({
          actions: { disconnect },
          state: unsupported,
        });
        yield* policy.transition({
          actions: { disconnect },
          state: unsupported,
        });
        yield* policy.transition({
          actions: { disconnect },
          state: disconnectedNormalizedWalletState,
        });
        yield* policy.transition({
          actions: { disconnect },
          state: unsupported,
        });
      });

      expect(disconnect).toHaveBeenCalledTimes(2);
      expect(disconnect).toHaveBeenCalledWith({ connector });
    })
  );

  it.effect("localizes tracking and disconnect failures", () =>
    Effect.gen(function* () {
      expect(
        yield* Effect.gen(function* () {
          const policy = yield* makePolicy(() => Effect.die("tracking failed"));
          yield* policy.transition({
            actions: { disconnect: () => Effect.die("disconnect failed") },
            state: connected(),
          });
          yield* policy.transition({
            actions: { disconnect: () => Effect.die("disconnect failed") },
            state: unsupported,
          });
        })
      ).toBeUndefined();
    })
  );
});
