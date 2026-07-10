import BigNumber from "bignumber.js";
import { Effect, Logger, Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  GasBalancesCommand,
  TokenBalanceScanCommand,
  TokenBalancesResponse,
  YieldBalancesCommand,
} from "../../src/domain/schema/financial-models";

const token = {
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  network: "ethereum",
  address: "0xAbCd",
} as const;

const decode = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: unknown
) =>
  Effect.runPromise(
    Schema.decodeUnknownEffect(schema)(input).pipe(
      Effect.provide(Logger.layer([]))
    )
  );

describe("financial API boundary schemas", () => {
  it("decodes wallet-scoped balance commands into branded application values", () => {
    const tokenCommand = Schema.decodeUnknownSync(TokenBalanceScanCommand)({
      addresses: { address: "0xWallet" },
      network: "ethereum",
    });
    const yieldCommand = Schema.decodeUnknownSync(YieldBalancesCommand)({
      queries: [
        {
          address: "0xWallet",
          network: "ethereum",
          yieldId: "ethereum-eth-native-staking",
        },
      ],
    });
    const gasCommand = Schema.decodeUnknownSync(GasBalancesCommand)({
      addresses: [
        {
          address: "0xWallet",
          network: "ethereum",
          tokenAddress: "0xGasToken",
        },
      ],
    });

    expect(tokenCommand.addresses.address).toBe("0xWallet");
    expect(gasCommand.addresses[0]?.tokenAddress).toBe("0xGasToken");
    expect(yieldCommand.queries[0]?.yieldId).toBe(
      "ethereum-eth-native-staking"
    );
  });

  it("omits a complete malformed token balance and retains valid siblings", async () => {
    const balances = await decode(TokenBalancesResponse, [
      {
        amount: "1.5",
        availableYields: ["ethereum-eth-native-staking"],
        token,
      },
      {
        amount: "NaN",
        availableYields: ["ethereum-eth-native-staking"],
        token,
      },
      {
        amount: "2",
        availableYields: ["ethereum-eth-native-staking"],
        token: { ...token, decimals: "18" },
      },
    ]);

    expect(balances).toHaveLength(1);
    expect(balances[0]?.amount).toBeInstanceOf(BigNumber);
    expect(balances[0]?.amount.toFixed()).toBe("1.5");
  });

  it("returns an empty balance list when every top-level entry is malformed", async () => {
    const balances = await decode(TokenBalancesResponse, [
      {
        amount: "not-a-decimal",
        availableYields: [],
        token,
      },
    ]);

    expect(balances).toEqual([]);
  });
});
