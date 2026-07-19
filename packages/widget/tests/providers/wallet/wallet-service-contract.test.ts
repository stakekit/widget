import type { Effect } from "effect";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
  WalletConnectionError,
  WalletDecodeError,
  type WalletRuntimeInvariantError,
  WalletSigningError,
  WalletSwitchError,
} from "../../../src/services/wallet/domain/errors";
import type {
  WalletBroadcastResult,
  WalletSignedPayloadResult,
} from "../../../src/services/wallet/domain/transactions";
import type { WalletService } from "../../../src/services/wallet/wallet-service";

type WalletTransactionResult =
  | WalletSignedPayloadResult
  | WalletBroadcastResult;

describe("wallet service contract", () => {
  it("keeps signed payloads distinct from broadcast hashes", () => {
    const signedPayload: WalletTransactionResult = {
      broadcasted: false,
      signedTx: "signed-payload",
    };
    const broadcastHash: WalletTransactionResult = {
      broadcasted: true,
      signedTx: "transaction-hash",
    };

    if (signedPayload.broadcasted) {
      expectTypeOf(signedPayload).toMatchTypeOf<never>();
    } else {
      expect(signedPayload.signedTx).toBe("signed-payload");
    }
    expect(broadcastHash).toEqual({
      broadcasted: true,
      signedTx: "transaction-hash",
    });
  });

  it("exposes operation-specific tagged failures", () => {
    const cause = new Error("provider rejected");
    const failures = [
      new WalletConnectionError({ cause, operation: "connect" }),
      new WalletSwitchError({ cause, operation: "chain", target: 1 }),
      new WalletSigningError({ cause, operation: "transaction" }),
      new WalletDecodeError({ cause }),
      new WalletBroadcastError({ cause, customMessage: "Try again" }),
      new WalletCapabilityUnavailableError({
        capability: "account",
        connectorId: "injected",
      }),
    ];

    expect(failures.map((failure) => failure._tag)).toEqual([
      "WalletConnectionError",
      "WalletSwitchError",
      "WalletSigningError",
      "WalletDecodeError",
      "WalletBroadcastError",
      "WalletCapabilityUnavailableError",
    ]);
    expect(failures.every((failure) => failure instanceof Error)).toBe(true);
  });

  it("defines Effect commands without a React dependency", () => {
    expectTypeOf<
      WalletService["Service"]["disconnect"]
    >().returns.toEqualTypeOf<
      Effect.Effect<void, WalletConnectionError | WalletRuntimeInvariantError>
    >();
  });
});
