import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { checkGasAmount } from "../../src/common/check-gas-amount";
import { TokenBalance } from "../../src/domain/schema/financial-models";

const gasTokenBalance = Schema.decodeUnknownSync(TokenBalance)({
  amount: "1",
  availableYields: [],
  token: {
    decimals: 18,
    name: "Ethereum",
    network: "ethereum",
    symbol: "ETH",
  },
});

describe("gas balance warning", () => {
  it("warns when the decoded gas-token balance is absent or insufficient", () => {
    expect(
      checkGasAmount({
        gasEstimate: new BigNumber("0.1"),
        gasTokenBalance: undefined,
        isStake: false,
      })
    ).toBe(true);
    expect(
      checkGasAmount({
        gasEstimate: new BigNumber("1.1"),
        gasTokenBalance,
        isStake: false,
      })
    ).toBe(true);
  });

  it("subtracts the stake amount when stake and gas use the same token", () => {
    expect(
      checkGasAmount({
        gasEstimate: new BigNumber("0.2"),
        gasTokenBalance,
        isStake: true,
        stakeAmount: new BigNumber("0.9"),
        stakeToken: gasTokenBalance.token,
      })
    ).toBe(true);
    expect(
      checkGasAmount({
        gasEstimate: new BigNumber("0.05"),
        gasTokenBalance,
        isStake: true,
        stakeAmount: new BigNumber("0.9"),
        stakeToken: gasTokenBalance.token,
      })
    ).toBe(false);
  });
});
