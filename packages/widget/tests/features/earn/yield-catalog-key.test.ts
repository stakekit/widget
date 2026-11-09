import { Equal, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { YieldId } from "../../../src/domain/identity/identifiers";
import { YieldCatalogKey } from "../../../src/features/earn/state/earn-selection/catalog/keys";

const firstYieldId = Schema.decodeSync(YieldId)("yield-a");
const secondYieldId = Schema.decodeSync(YieldId)("yield-b");

describe("Yield catalog key", () => {
  it("canonicalizes unordered catalog identifiers, so equivalent catalogs share one key", () => {
    const first = new YieldCatalogKey({
      category: null,
      network: "ethereum",
      token: "ETH",
      yieldIds: [secondYieldId, firstYieldId, secondYieldId],
    });
    const equivalent = new YieldCatalogKey({
      category: null,
      network: "ethereum",
      token: "ETH",
      yieldIds: [firstYieldId, secondYieldId],
    });

    expect(first.yieldIds).toEqual([firstYieldId, secondYieldId]);
    expect(first.token).toBe("ETH");
    expect(Equal.equals(first, equivalent)).toBe(true);
  });
});
