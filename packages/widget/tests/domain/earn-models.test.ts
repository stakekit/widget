import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  EarnBalance,
  EarnPosition,
  EarnProvider,
  EarnToken,
  EarnValidator,
  EarnYield,
} from "../../src/domain/schema/earn-models";
import { yieldApiYieldFixture } from "../fixtures";

const token = {
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  network: "ethereum",
  address: "0xAbCd",
} as const;

describe("Earn application models", () => {
  it("brands token/provider identifiers without changing case-sensitive addresses", () => {
    const decodedToken = Schema.decodeUnknownSync(EarnToken)(token);
    const provider = Schema.decodeUnknownSync(EarnProvider)({
      id: "stakekit",
      name: "StakeKit",
      description: "",
      logoURI:
        "https://assets.stakek.it/app/composition/providers/stakekit.svg",
      website: "https://stakek.it",
      tvlUsd: null,
      type: "protocol",
    });

    expect(decodedToken.address).toBe("0xAbCd");
    expect(provider.id).toBe("stakekit");
  });

  it("derives stable validator keys through Schema", () => {
    const validator = Schema.decodeUnknownSync(EarnValidator)({
      address: "validator-1",
      subnet: { id: 7, name: "Subnet 7" },
    });

    expect(validator.key).toBe("validator-1:7");
  });

  it("uses lossless balance amount and raw-unit representations", () => {
    const balance = Schema.decodeUnknownSync(EarnBalance)({
      address: "wallet-1",
      type: "active",
      amount: "9007199254740993.000000000000000001",
      amountRaw: "9007199254740993000000000000000001",
      pendingActions: [],
      token,
      amountUsd: "12345678901234567890.12",
      isEarning: true,
    });

    expect(BigNumber.isBigNumber(balance.amount)).toBe(true);
    expect(balance.amount.toFixed()).toBe(
      "9007199254740993.000000000000000001"
    );
    expect(balance.amountRaw).toBe(9007199254740993000000000000000001n);
    expect(balance.amountUsd?.toFixed()).toBe("12345678901234567890.12");
  });

  it("decodes complete yield and position models with branded yield IDs", () => {
    const yieldModel = Schema.decodeUnknownSync(EarnYield)(
      yieldApiYieldFixture({ prime: false })
    );
    const position = Schema.decodeUnknownSync(EarnPosition)({
      yieldId: yieldModel.id,
      balances: [
        {
          address: "wallet-1",
          type: "active",
          amount: "1.5",
          amountRaw: "1500000000000000000",
          pendingActions: [],
          token,
          isEarning: true,
        },
      ],
      outputTokenBalance: null,
    });

    expect(yieldModel.id).toBe("ethereum-eth-native-staking");
    expect(position.yieldId).toBe(yieldModel.id);
    expect(position.balances[0]?.amount.toFixed()).toBe("1.5");
  });
});
