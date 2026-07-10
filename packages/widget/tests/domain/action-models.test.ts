import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  ActionCommand,
  TransactionGasEstimateJson,
  YieldAction,
} from "../../src/domain/schema/action-models";
import { yieldApiActionFixture, yieldApiTransactionFixture } from "../fixtures";

const transaction = yieldApiTransactionFixture({
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

const action = yieldApiActionFixture({
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
