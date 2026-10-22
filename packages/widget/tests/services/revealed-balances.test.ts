import { describe, expect, it } from "@effect/vitest";
import { Effect, HashMap, Option } from "effect";
import { ConfidentialTokenBalanceKey } from "../../src/domain/earn/confidential";
import { RevealedBalances } from "../../src/services/zama/revealed-balances";
import { confidentialYieldFixture } from "../fixtures";

const token = confidentialYieldFixture().inputTokens[0]!;
const checksummed = "0xAbCd000000000000000000000000000000000001";

describe("RevealedBalances", () => {
  it.effect(
    "finds and forgets a token balance however its owner address is cased",
    () =>
      Effect.gen(function* () {
        const values = yield* RevealedBalances;
        yield* values.addTokenBalance(
          new ConfidentialTokenBalanceKey({ owner: checksummed, token }),
          9n
        );
        const lowercased = new ConfidentialTokenBalanceKey({
          owner: checksummed.toLowerCase(),
          token,
        });
        const found = HashMap.get(
          (yield* values.current).tokenBalances,
          lowercased
        );

        yield* values.forgetTokenBalance(lowercased);

        expect(Option.getOrNull(found)).toBe(9n);
        expect(HashMap.size((yield* values.current).tokenBalances)).toBe(0);
      }).pipe(Effect.provide(RevealedBalances.layer))
  );
});
