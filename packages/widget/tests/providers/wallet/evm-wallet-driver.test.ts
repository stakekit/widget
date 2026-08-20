import { Effect } from "effect";
import type { Hash } from "viem";
import { zeroAddress } from "viem";
import { describe, expect, it, vi } from "vitest";
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
  it("preserves a quoted Base Unit Amount beyond the JavaScript safe integer range", async () => {
    const value = "1000000000000000001";
    const decoded = await Effect.runPromise(
      decodeEvmTransaction(transaction({ gasPrice: "7", value }))
    );

    expect(decoded.value).toBe(1000000000000000001n);
  });

  it("decodes hex-quoted quantities as Base Unit Amounts", async () => {
    const decoded = await Effect.runPromise(
      decodeEvmTransaction(
        transaction({ gasLimit: "0x0193e0", maxFeePerGas: "0xbfa6de" })
      )
    );

    expect(decoded.gas).toBe(103_392n);
    expect(decoded).toMatchObject({ maxFeePerGas: 12_560_094n });
  });

  it("prepares a legacy request and preserves its gas price", async () => {
    await expect(
      Effect.runPromise(decodeEvmTransaction(transaction({ gasPrice: "7" })))
    ).resolves.toEqual({
      chainId: 1,
      data: "0x1234",
      gas: 21_000n,
      gasPrice: 7n,
      to: zeroAddress,
      type: "legacy",
      value: 12n,
    });
  });

  it("prepares an EIP-1559 request and preserves both fee fields", async () => {
    await expect(
      Effect.runPromise(
        decodeEvmTransaction(
          transaction({ maxFeePerGas: "9", maxPriorityFeePerGas: "2" })
        )
      )
    ).resolves.toEqual({
      chainId: 1,
      data: "0x1234",
      gas: 21_000n,
      maxFeePerGas: 9n,
      maxPriorityFeePerGas: 2n,
      to: zeroAddress,
      type: "eip1559",
      value: 12n,
    });
  });

  it("returns a broadcast result from the core send command", async () => {
    const hash = `0x${"1".repeat(64)}` as Hash;
    const sendTransaction = vi.fn(() =>
      Effect.succeed({ broadcasted: true as const, signedTx: hash })
    );
    const driver = makeEvmWalletDriver({ sendTransaction });

    await expect(
      Effect.runPromise(
        driver.signTransaction({ tx: transaction({ gasPrice: "7" }) })
      )
    ).resolves.toEqual({ broadcasted: true, signedTx: hash });
    expect(sendTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ gasPrice: 7n, type: "legacy" })
    );
  });

  it("keeps decoding and broadcasting failures distinct", async () => {
    const cause = new Error("provider rejected");
    const driver = makeEvmWalletDriver({
      sendTransaction: () =>
        Effect.fail(new WalletBroadcastError({ cause, customMessage: null })),
    });

    const decodeFailure = await Effect.runPromise(
      Effect.flip(driver.signTransaction({ tx: "not-json" }))
    );
    const broadcastFailure = await Effect.runPromise(
      Effect.flip(
        driver.signTransaction({ tx: transaction({ gasPrice: "7" }) })
      )
    );

    expect(decodeFailure._tag).toBe("WalletDecodeError");
    expect(broadcastFailure).toEqual(
      new WalletBroadcastError({ cause, customMessage: null })
    );
  });
});
