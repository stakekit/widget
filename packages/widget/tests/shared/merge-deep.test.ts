import { describe, expect, it } from "vitest";
import { mergeDeep } from "../../src/shared/effect/merge-deep";

describe("mergeDeep", () => {
  it("overlays nested records without mutating inputs", () => {
    const base = { errors: { rent: { title: "LOCAL", details: "LOCAL" } } };
    const overlay = { errors: { rent: { title: "HOST" } } };

    expect(mergeDeep(base, overlay)).toEqual({
      errors: { rent: { title: "HOST", details: "LOCAL" } },
    });
    expect(base.errors.rent.title).toBe("LOCAL");
  });

  it("keeps the previous value when a later source is undefined", () => {
    expect(mergeDeep({ a: 1 }, undefined, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it("replaces arrays instead of merging them by index", () => {
    expect(mergeDeep({ items: [1, 2] }, { items: [3] })).toEqual({
      items: [3],
    });
  });
});
