import { Equal, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { YieldId } from "../../src/domain/schema/identifiers";
import {
  CurrentRewardsSummaryKey,
  positiveRewardsSummaryAtom,
} from "../../src/features/earn/resources/yield-insights";
import { earnYieldCatalogAtom } from "../../src/features/earn/state/atoms-state/catalog/atoms";
import {
  TokenYieldScopeKey,
  YieldCatalogKey,
} from "../../src/features/earn/state/atoms-state/catalog/keys";

const firstYieldId = Schema.decodeSync(YieldId)("yield-a");
const secondYieldId = Schema.decodeSync(YieldId)("yield-b");

describe("atom family key identity", () => {
  it("canonicalizes unordered reward identifiers before family selection", () => {
    const first = new CurrentRewardsSummaryKey({
      yieldIds: [secondYieldId, firstYieldId, secondYieldId],
    });
    const equivalent = new CurrentRewardsSummaryKey({
      yieldIds: [firstYieldId, secondYieldId],
    });

    expect(first.yieldIds).toEqual([firstYieldId, secondYieldId]);
    expect(positiveRewardsSummaryAtom(first)).toBe(
      positiveRewardsSummaryAtom(equivalent)
    );
  });

  it("canonicalizes unordered catalog identifiers before family selection", () => {
    const first = new YieldCatalogKey({
      category: null,
      network: "ethereum",
      yieldIds: [secondYieldId, firstYieldId, secondYieldId],
    });
    const equivalent = new YieldCatalogKey({
      category: null,
      network: "ethereum",
      yieldIds: [firstYieldId, secondYieldId],
    });

    expect(first.yieldIds).toEqual([firstYieldId, secondYieldId]);
    expect(earnYieldCatalogAtom(first)).toBe(earnYieldCatalogAtom(equivalent));
  });

  it("uses value-equal scope keys for companion state", () => {
    const first = new TokenYieldScopeKey({
      category: "stake",
      yieldIds: [secondYieldId, firstYieldId, secondYieldId],
    });
    const equivalent = new TokenYieldScopeKey({
      category: "stake",
      yieldIds: [firstYieldId, secondYieldId],
    });

    expect(Equal.equals(first, equivalent)).toBe(true);
  });
});
