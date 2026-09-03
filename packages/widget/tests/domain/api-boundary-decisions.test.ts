import { describe, expect, it } from "@effect/vitest";
import BigNumber from "bignumber.js";
import { Effect, Logger, References, Schema } from "effect";
import { logDecodeRejection } from "../../src/domain/decoding/decode-diagnostics";
import { ExactDecimal } from "../../src/domain/finance/scalars";

describe("API boundary foundation decisions", () => {
  it("decodes precision-sensitive decimals to BigNumber without precision loss", () => {
    const value = Schema.decodeSync(ExactDecimal)(
      "12345678901234567890.123456789012345678"
    );

    expect(BigNumber.isBigNumber(value)).toBe(true);
    expect(value.toFixed()).toBe("12345678901234567890.123456789012345678");
    expect(Schema.encodeSync(ExactDecimal)(value)).toBe(
      "12345678901234567890.123456789012345678"
    );
    expect(() => Schema.decodeSync(ExactDecimal)("NaN")).toThrow();
  });

  it.effect(
    "emits structured warning diagnostics without the rejected value",
    () =>
      Effect.gen(function* () {
        const annotations: Array<Record<string, unknown>> = [];
        const logger = Logger.make<unknown, void>((options) => {
          annotations.push({
            ...options.fiber.getRef(References.CurrentLogAnnotations),
          });
        });

        yield* logDecodeRejection({
          operation: "yield-catalog",
          location: 2,
          identifier: "yield-id",
          issue: "id is missing",
        }).pipe(Effect.provide(Logger.layer([logger])));

        expect(annotations).toEqual([
          {
            event: "api_decode_rejection",
            operation: "yield-catalog",
            location: "2",
            identifier: "yield-id",
            issue: "id is missing",
          },
        ]);
      })
  );
});
