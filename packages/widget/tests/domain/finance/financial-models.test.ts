import { describe, expect, it } from "@effect/vitest";
import BigNumber from "bignumber.js";
import { Effect, Logger, Schema } from "effect";

import { TokenBalancesResponse } from "../../../src/domain/finance/models";

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
  Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.provide(Logger.layer([]))
  );

describe("financial API boundary schemas", () => {
  it.effect(
    "omits a complete malformed token balance and retains valid siblings",
    () =>
      Effect.gen(function* () {
        const balances = yield* decode(TokenBalancesResponse, [
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
      })
  );
});
