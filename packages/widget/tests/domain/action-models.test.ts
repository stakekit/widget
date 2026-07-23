import BigNumber from "bignumber.js";
import { Effect, Logger, References, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  ActionCommand,
  TransactionGasEstimateJson,
  YieldAction,
} from "../../src/domain/schema/action-models";
import {
  yieldApiActionDtoFixture,
  yieldApiTransactionDtoFixture,
} from "../fixtures";

const transaction = yieldApiTransactionDtoFixture({
  gasEstimate: JSON.stringify({
    amount: "0.01",
    token: {
      decimals: 18,
      name: "Ethereum",
      network: "ethereum",
      symbol: "ETH",
    },
  }),
  id: "transaction-1",
  network: "ethereum",
});

const action = yieldApiActionDtoFixture({
  address: "0xWallet",
  id: "action-1",
  transactions: [transaction],
  yieldId: "ethereum-eth-native-staking",
});

describe("action application schemas", () => {
  it("brands command and response identifiers at the application boundary", () => {
    const command = Schema.decodeUnknownSync(ActionCommand)({
      address: "0xWallet",
      arguments: { amount: "1" },
      yieldId: "ethereum-eth-native-staking",
    });
    const model = Schema.decodeUnknownSync(YieldAction)(action);

    expect(command.yieldId).toBe("ethereum-eth-native-staking");
    expect(model.id).toBe("action-1");
    expect(model.transactions[0]?.id).toBe("transaction-1");
  });

  it("strictly rejects a malformed nested transaction", () => {
    expect(() =>
      Schema.decodeUnknownSync(YieldAction)({
        ...action,
        transactions: [{ ...transaction, id: "" }],
      })
    ).toThrow();
  });

  it("rejects invalid required timestamps", async () => {
    await expect(
      Effect.runPromise(
        Schema.decodeUnknownEffect(YieldAction)({
          ...action,
          createdAt: "invalid",
        })
      )
    ).rejects.toThrow();
  });

  it("safely clears invalid nullable timestamps and emits structured warnings", async () => {
    const annotations: Array<Record<string, unknown>> = [];
    const logger = Logger.make<unknown, void>((options) => {
      annotations.push({
        ...options.fiber.getRef(References.CurrentLogAnnotations),
      });
    });
    const decoded = await Effect.runPromise(
      Schema.decodeUnknownEffect(YieldAction)({
        ...action,
        completedAt: "invalid-completion",
        transactions: [
          {
            ...transaction,
            broadcastedAt: "invalid-broadcast",
          },
        ],
      }).pipe(Effect.provide(Logger.layer([logger])))
    );

    expect(decoded.completedAt).toBeNull();
    expect(decoded.transactions[0]?.broadcastedAt).toBeNull();
    expect(annotations).toHaveLength(2);
    expect(annotations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "api_decode_field_rejection",
          operation: "yield-action",
          field: "completedAt",
        }),
        expect.objectContaining({
          event: "api_decode_field_rejection",
          operation: "yield-action-transaction",
          field: "broadcastedAt",
        }),
      ])
    );
    expect(JSON.stringify(annotations)).not.toContain("invalid-completion");
    expect(JSON.stringify(annotations)).not.toContain("invalid-broadcast");
  });

  it("decodes transaction gas JSON only through Effect Schema", () => {
    const gas = Schema.decodeUnknownSync(TransactionGasEstimateJson)(
      transaction.gasEstimate
    );

    expect(gas.amount).toBeInstanceOf(BigNumber);
    expect(gas.amount.toFixed()).toBe("0.01");
    expect(() =>
      Schema.decodeUnknownSync(TransactionGasEstimateJson)("not-json")
    ).toThrow();
  });
});
