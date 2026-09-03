import { describe, expect, it } from "@effect/vitest";
import BigNumber from "bignumber.js";
import { Effect, Logger, References, Schema } from "effect";
import {
  ActionCommand,
  PendingAction,
  TransactionGasEstimateJson,
  YieldAction,
} from "../../src/domain/action/models";
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
    const command = Schema.decodeSync(ActionCommand)({
      address: "0xWallet",
      arguments: { amount: "1" },
      yieldId: "ethereum-eth-native-staking",
    });
    const model = Schema.decodeSync(YieldAction)(action);

    expect(command.yieldId).toBe("ethereum-eth-native-staking");
    expect(model.id).toBe("action-1");
    expect(model.transactions[0]?.id).toBe("transaction-1");
  });

  it("strictly rejects a malformed nested transaction", () => {
    expect(() =>
      Schema.decodeSync(YieldAction)({
        ...action,
        transactions: [{ ...transaction, id: "" }],
      })
    ).toThrow();
  });

  it.effect("rejects invalid required timestamps", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(
        Schema.decodeEffect(YieldAction)({
          ...action,
          createdAt: "invalid",
        })
      );

      expect(() => {
        throw failure;
      }).toThrow();
    })
  );

  it.effect(
    "safely clears invalid nullable timestamps and emits structured warnings",
    () =>
      Effect.gen(function* () {
        const annotations: Array<Record<string, unknown>> = [];
        const logger = Logger.make<unknown, void>((options) => {
          annotations.push({
            ...options.fiber.getRef(References.CurrentLogAnnotations),
          });
        });
        const decoded = yield* Schema.decodeEffect(YieldAction)({
          ...action,
          completedAt: "invalid-completion",
          transactions: [
            {
              ...transaction,
              broadcastedAt: "invalid-broadcast",
            },
          ],
        }).pipe(Effect.provide(Logger.layer([logger])));

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
      })
  );

  it("decodes transaction gas JSON only through Effect Schema", () => {
    const gas = Schema.decodeUnknownSync(TransactionGasEstimateJson)(
      transaction.gasEstimate
    );

    expect(gas.amount).toBeInstanceOf(BigNumber);
    expect(gas.amount.toFixed()).toBe("0.01");
    expect(() =>
      Schema.decodeSync(TransactionGasEstimateJson)("not-json")
    ).toThrow();
  });

  it("keeps Pending Action argument notes from the argument schema", () => {
    const pendingAction = Schema.decodeSync(PendingAction)({
      intent: "manage",
      passthrough: "claim",
      type: "CLAIM_REWARDS",
      arguments: {
        notes: "Claim before the period ends",
        fields: [
          {
            label: "Amount",
            name: "amount",
            required: true,
            type: "string",
          },
        ],
      },
    });

    expect(pendingAction.arguments?.notes).toBe("Claim before the period ends");
  });
});
