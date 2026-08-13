import { Effect, Fiber, Schedule } from "effect";
import { zeroAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
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
  it("submits and polls until the Safe transaction succeeds", async () => {
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

    await expect(
      Effect.runPromise(driver.signTransaction({ address: zeroAddress, tx }))
    ).resolves.toEqual({
      broadcasted: true,
      signedTx: "0xsafe-hash",
    });
    expect(attempts).toBe(2);
  });

  it("does not retry a terminal Safe failure", async () => {
    const getTxStatus = vi.fn(() =>
      Effect.succeed({ txHash: null, txStatus: statuses.FAILED })
    );
    const failure = await Effect.runPromise(
      Effect.flip(
        makeSafeWalletDriver({
          confirmationRetries: 2,
          confirmationSchedule: Schedule.spaced("1 millis"),
          connector: makeConnector(getTxStatus),
        }).signTransaction({ address: zeroAddress, tx })
      )
    );

    expect(failure._tag).toBe("WalletBroadcastError");
    expect(getTxStatus).toHaveBeenCalledTimes(1);
  });

  it("interrupts confirmation polling without a React unmount check", async () => {
    const getTxStatus = vi.fn(() =>
      Effect.succeed({
        txHash: null,
        txStatus: statuses.AWAITING_CONFIRMATIONS,
      })
    );
    const fiber = Effect.runFork(
      makeSafeWalletDriver({
        confirmationRetries: 120,
        confirmationSchedule: Schedule.spaced("1 hour"),
        connector: makeConnector(getTxStatus),
      }).signTransaction({ address: zeroAddress, tx })
    );

    await vi.waitFor(() => expect(getTxStatus).toHaveBeenCalledTimes(1));
    await Effect.runPromise(Fiber.interrupt(fiber));
    await Promise.resolve();

    expect(getTxStatus).toHaveBeenCalledTimes(1);
  });
});
