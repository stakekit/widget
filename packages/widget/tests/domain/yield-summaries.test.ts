import { describe, expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { EarnYieldPage } from "../../src/domain/earn/models";
import { yieldApiYieldDtoFixture } from "../fixtures";

describe("yield summary atom boundary", () => {
  it.effect(
    "retains valid summaries when a top-level sibling is malformed",
    () =>
      Effect.gen(function* () {
        const valid = yieldApiYieldDtoFixture({
          id: "yield-valid",
          prime: false,
        });
        const invalid: Record<string, unknown> = {
          ...yieldApiYieldDtoFixture({ id: "yield-invalid", prime: false }),
          token: { ...valid.token, decimals: "invalid" },
        };
        const page = yield* Schema.decodeEffect(EarnYieldPage)({
          items: [valid, invalid],
          limit: 2,
          offset: 0,
          total: 2,
        });

        expect(page.items?.map((item) => item.id)).toEqual(["yield-valid"]);
        expect(page.total).toBe(2);
      })
  );
});
