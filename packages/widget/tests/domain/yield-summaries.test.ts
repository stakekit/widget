import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { EarnYieldPage } from "../../src/domain/schema/earn-models";
import { YieldId } from "../../src/domain/schema/identifiers";
import { getUniqueYieldIdChunks } from "../../src/features/earn/resources/yields";
import { yieldApiYieldFixture } from "../fixtures";

const id = Schema.decodeUnknownSync(YieldId);

describe("yield summary atom boundary", () => {
  it("deduplicates IDs, preserves first occurrence order, and bounds chunks", () => {
    expect(
      getUniqueYieldIdChunks(
        [id("yield-2"), id("yield-1"), id("yield-2"), id("yield-0")],
        2
      )
    ).toEqual([["yield-2", "yield-1"], ["yield-0"]]);
  });

  it("retains valid summaries when a top-level sibling is malformed", async () => {
    const valid = yieldApiYieldFixture({ id: "yield-valid", prime: false });
    const invalid: Record<string, unknown> = {
      ...yieldApiYieldFixture({ id: "yield-invalid", prime: false }),
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
