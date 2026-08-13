import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { EarnYieldPage } from "../../src/domain/earn/models";
import { yieldApiYieldDtoFixture } from "../fixtures";

describe("yield summary atom boundary", () => {
  it("retains valid summaries when a top-level sibling is malformed", async () => {
    const valid = yieldApiYieldDtoFixture({ id: "yield-valid", prime: false });
    const invalid: Record<string, unknown> = {
      ...yieldApiYieldDtoFixture({ id: "yield-invalid", prime: false }),
      token: { ...valid.token, decimals: "invalid" },
    };
    const page = await Effect.runPromise(
      Schema.decodeUnknownEffect(EarnYieldPage)({
        items: [valid, invalid],
        limit: 2,
        offset: 0,
        total: 2,
      })
    );

    expect(page.items?.map((item) => item.id)).toEqual(["yield-valid"]);
    expect(page.total).toBe(2);
  });
});
