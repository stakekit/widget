import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import {
  ConfidentialHandle,
  confidentialTokenBalanceKey,
  isConfidentialHandle,
} from "../../src/domain/earn/confidential";
import { ConfidentialValues } from "../../src/services/zama/confidential-values";
import { confidentialYieldFixture } from "../fixtures";

const handle = Schema.decodeSync(ConfidentialHandle)(`0x${"ab".repeat(32)}`);
const tokenBalance = confidentialTokenBalanceKey({
  owner: "0xowner",
  token: confidentialYieldFixture().inputTokens[0]!,
});

describe("ConfidentialValues", () => {
  it.effect("forgets only the values the predicate selects", () =>
    Effect.gen(function* () {
      const values = yield* ConfidentialValues;
      yield* values.add([
        [handle, 5n],
        [tokenBalance, 9n],
      ]);

      yield* values.remove(isConfidentialHandle);

      expect([...(yield* values.current)]).toEqual([[tokenBalance, 9n]]);
    }).pipe(Effect.provide(ConfidentialValues.layer))
  );
});
