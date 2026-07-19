import { Effect, Exit, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  decodeBorrowTransactionForWallet,
  Transaction,
} from "../../src/domain/borrow/transaction";
import { WalletAddress } from "../../src/domain/schema/identifiers";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

const transaction = (signablePayload: unknown) =>
  Schema.decodeUnknownSync(Transaction)({
    address,
    chainId: "8453",
    id: "tx-1",
    network: "base",
    signablePayload,
    signingFormat: "EVM_TRANSACTION",
    status: "WAITING_FOR_SIGNATURE",
    type: "BORROW",
  });

describe("borrow transaction wallet normalization", () => {
  it("strictly decodes and serializes an EVM payload for the wallet", async () => {
    const serialized = await Effect.runPromise(
      decodeBorrowTransactionForWallet(
        transaction(
          JSON.stringify({
            data: "0xabcdef",
            from: address,
            gasLimit: "21000",
            to: "0x0000000000000000000000000000000000000002",
            value: "0",
          })
        )
      )
    );

    expect(JSON.parse(serialized)).toEqual({
      chainId: 8453,
      data: "0xabcdef",
      from: address,
      gasLimit: "21000",
      nonce: 0,
      to: "0x0000000000000000000000000000000000000002",
      type: 0,
      value: "0",
    });
  });

  it("rejects missing, malformed, and non-hex payload fields", async () => {
    const valid = transaction(
      JSON.stringify({
        data: "0xabcdef",
        from: address,
        gasLimit: "21000",
        to: address,
      })
    );

    for (const payload of [
      undefined,
      "not-json",
      JSON.stringify({
        data: "invalid",
        from: address,
        gasLimit: "21000",
        to: address,
      }),
    ]) {
      const exit = await Effect.runPromiseExit(
        decodeBorrowTransactionForWallet({
          ...valid,
          signablePayload: payload,
        } as Transaction)
      );

      expect(Exit.isFailure(exit)).toBe(true);
    }
  });
});
