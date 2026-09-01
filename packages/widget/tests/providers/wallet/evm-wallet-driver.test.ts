import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import type { Hash } from "viem";
import { zeroAddress } from "viem";
import {
  decodeEvmTransaction,
  makeEvmWalletDriver,
} from "../../../src/services/wallet/internal/adapters/evm/driver";
import { WalletBroadcastError } from "../../../src/services/wallet/wallet-errors";

const transaction = (fees: object) =>
  JSON.stringify({
    chainId: 1,
    data: "0x1234",
    from: zeroAddress,
    gasLimit: "21000",
    nonce: 1,
    to: zeroAddress,
    type: 2,
    value: "12",
    ...fees,
  });

describe("EVM wallet driver", () => {
  it.effect(
    "preserves a quoted Base Unit Amount beyond the JavaScript safe integer range",
    () =>
      Effect.gen(function* () {
        const value = "1000000000000000001";
        const decoded = yield* decodeEvmTransaction(
          transaction({ gasPrice: "7", value })
        );

        expect(decoded.value).toBe(1000000000000000001n);
      })
  );

  it.effect("decodes hex-quoted quantities as Base Unit Amounts", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeEvmTransaction(
        transaction({ gasLimit: "0x0193e0", maxFeePerGas: "0xbfa6de" })
      );

      expect(decoded.gas).toBe(103_392n);
      expect(decoded).toMatchObject({ maxFeePerGas: 12_560_094n });
    })
  );

  it.effect("prepares a legacy request and preserves its gas price", () =>
    Effect.gen(function* () {
      expect(
        yield* decodeEvmTransaction(transaction({ gasPrice: "7" }))
      ).toEqual({
        chainId: 1,
        data: "0x1234",
        gas: 21_000n,
        gasPrice: 7n,
        to: zeroAddress,
        type: "legacy",
        value: 12n,
      });
    })
  );

  it.effect("prepares an EIP-1559 request and preserves both fee fields", () =>
    Effect.gen(function* () {
      expect(
        yield* decodeEvmTransaction(
          transaction({ maxFeePerGas: "9", maxPriorityFeePerGas: "2" })
        )
      ).toEqual({
        chainId: 1,
        data: "0x1234",
        gas: 21_000n,
        maxFeePerGas: 9n,
        maxPriorityFeePerGas: 2n,
        to: zeroAddress,
        type: "eip1559",
        value: 12n,
      });
    })
  );

  it.effect("returns a broadcast result from the core send command", () =>
    Effect.gen(function* () {
      const hash = `0x${"1".repeat(64)}` as Hash;
      const sendTransaction = vi.fn(() =>
        Effect.succeed({ broadcasted: true as const, signedTx: hash })
      );
      const driver = makeEvmWalletDriver({ sendTransaction });

      expect(
        yield* driver.signTransaction({ tx: transaction({ gasPrice: "7" }) })
      ).toEqual({ broadcasted: true, signedTx: hash });
      expect(sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ gasPrice: 7n, type: "legacy" })
      );
    })
  );

  it.effect("keeps decoding and broadcasting failures distinct", () =>
    Effect.gen(function* () {
      const cause = new Error("provider rejected");
      const driver = makeEvmWalletDriver({
        sendTransaction: () =>
          Effect.fail(new WalletBroadcastError({ cause, customMessage: null })),
      });

      const decodeFailure = yield* Effect.flip(
        driver.signTransaction({ tx: "not-json" })
      );
      const broadcastFailure = yield* Effect.flip(
        driver.signTransaction({ tx: transaction({ gasPrice: "7" }) })
      );

      expect(decodeFailure._tag).toBe("WalletDecodeError");
      expect(broadcastFailure).toEqual(
        new WalletBroadcastError({ cause, customMessage: null })
      );
    })
  );
});
