import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Fiber, Schedule } from "effect";
import { zeroAddress } from "viem";
import type { Connector } from "wagmi";
import { makeSafeWalletDriver } from "../../../src/services/wallet/internal/adapters/safe/driver";

const tx = JSON.stringify({
  chainId: 1,
  data: "0x1234",
  from: zeroAddress,
  gasLimit: "21000",
  gasPrice: "1",
  nonce: 1,
  to: zeroAddress,
  type: 0,
});

const statuses = {
  AWAITING_CONFIRMATIONS: "AWAITING_CONFIRMATIONS",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
  SUCCESS: "SUCCESS",
};

const makeConnector = (
  getTxStatus: () => Effect.Effect<
    { readonly txHash: string | null; readonly txStatus: string },
    Error
  >
) =>
  ({
    getTxStatus,
    id: "safe",
    sendTransactions: vi.fn(() => Effect.succeed({ safeTxHash: "safe-hash" })),
    txStatus: statuses,
  }) as unknown as Connector;

describe("Safe wallet driver", () => {
  it.live("submits and polls until the Safe transaction succeeds", () =>
    Effect.gen(function* () {
      let attempts = 0;
      const connector = makeConnector(() => {
        attempts += 1;
        return Effect.succeed(
          attempts === 1
            ? { txHash: null, txStatus: statuses.AWAITING_CONFIRMATIONS }
            : { txHash: "0xsafe-hash", txStatus: statuses.SUCCESS }
        );
      });
      const driver = makeSafeWalletDriver({
        confirmationRetries: 2,
        confirmationSchedule: Schedule.spaced("1 millis"),
        connector,
      });

      expect(
        yield* driver.signTransaction({
          address: zeroAddress,
          family: "classic",
          tx,
        })
      ).toEqual({
        broadcasted: true,
        signedTx: "0xsafe-hash",
      });
      expect(attempts).toBe(2);
    })
  );

  it.effect("does not retry a terminal Safe failure", () =>
    Effect.gen(function* () {
      const getTxStatus = vi.fn(() =>
        Effect.succeed({ txHash: null, txStatus: statuses.FAILED })
      );
      const failure = yield* Effect.flip(
        makeSafeWalletDriver({
          confirmationRetries: 2,
          confirmationSchedule: Schedule.spaced("1 millis"),
          connector: makeConnector(getTxStatus),
        }).signTransaction({ address: zeroAddress, family: "classic", tx })
      );

      expect(failure._tag).toBe("WalletBroadcastError");
      expect(getTxStatus).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "interrupts confirmation polling without a React unmount check",
    () =>
      Effect.gen(function* () {
        const getTxStatus = vi.fn(() =>
          Effect.succeed({
            txHash: null,
            txStatus: statuses.AWAITING_CONFIRMATIONS,
          })
        );
        const fiber = yield* Effect.forkChild(
          makeSafeWalletDriver({
            confirmationRetries: 120,
            confirmationSchedule: Schedule.spaced("1 hour"),
            connector: makeConnector(getTxStatus),
          }).signTransaction({ address: zeroAddress, family: "classic", tx })
        );

        yield* Effect.promise(() =>
          vi.waitFor(() => expect(getTxStatus).toHaveBeenCalledTimes(1))
        );
        yield* Fiber.interrupt(fiber);
        yield* Effect.promise(() => Promise.resolve());

        expect(getTxStatus).toHaveBeenCalledTimes(1);
      })
  );
});
