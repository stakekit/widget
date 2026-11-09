import { describe, expect, it } from "vitest";

import { compositeKey } from "../../../src/shared/lib/composite-key";

describe("compositeKey", () => {
  it("gives equal parts the same key", () => {
    expect(compositeKey(["position", "yield-1", { network: "ethereum" }])).toBe(
      compositeKey(["position", "yield-1", { network: "ethereum" }])
    );
  });

  it("keeps part boundaries, so a separator inside a part cannot collide", () => {
    expect(compositeKey(["a,b", "c"])).not.toBe(compositeKey(["a", "b,c"]));
    expect(compositeKey(["a", null])).not.toBe(compositeKey(["a", "null"]));
  });
});
