import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Schema } from "effect";
import {
  decodeBorrowTransactionForWallet,
  Transaction,
} from "../../../src/domain/borrow/execution/transaction";
import { WalletAddress } from "../../../src/domain/identity/identifiers";

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
  it.effect(
    "strictly decodes and serializes an EVM payload for the wallet",
    () =>
      Effect.gen(function* () {
        const serialized = yield* decodeBorrowTransactionForWallet(
          transaction(
            JSON.stringify({
              data: "0xabcdef",
              from: address,
              gasLimit: "21000",
              to: "0x0000000000000000000000000000000000000002",
              value: "0",
            })
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
      })
  );

  it.effect("rejects missing, malformed, and non-hex payload fields", () =>
    Effect.gen(function* () {
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
        const exit = yield* Effect.exit(
          decodeBorrowTransactionForWallet({
            ...valid,
            signablePayload: payload,
          } as Transaction)
        );

        expect(Exit.isFailure(exit)).toBe(true);
      }
    })
  );

  it.effect(
    "preserves a quoted Base Unit Amount beyond the JavaScript safe integer range",
    () =>
      Effect.gen(function* () {
        const serialized = yield* decodeBorrowTransactionForWallet(
          transaction(
            JSON.stringify({
              data: "0xabcdef",
              from: address,
              gasLimit: "21000",
              to: "0x0000000000000000000000000000000000000002",
              value: "1000000000000000001",
            })
          )
        );

        expect(JSON.parse(serialized)).toMatchObject({
          gasLimit: "21000",
          value: "1000000000000000001",
        });
      })
  );
});
