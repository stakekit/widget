import { describe, expect, it } from "vitest";

import {
  formatNetworkName,
  humanizeEnumValue,
} from "../../../src/shared/lib/formatters";

describe("shared formatters", () => {
  it("formats network names", () => {
    expect(formatNetworkName("ethereum")).toBe("Ethereum");
    expect(formatNetworkName("arbitrum-one")).toBe("Arbitrum One");
  });

  it("humanizes enum-like values", () => {
    expect(humanizeEnumValue("block")).toBe("Block");
    expect(humanizeEnumValue("WITHDRAWAL_REQUEST")).toBe("Withdrawal Request");
    expect(humanizeEnumValue("FOO__BAR")).toBe("Foo Bar");
  });
});
