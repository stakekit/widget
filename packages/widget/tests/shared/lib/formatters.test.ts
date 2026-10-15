import { describe, expect, it } from "vitest";
import {
  formatBorrowProviderName,
  formatNetworkName,
  humanizeEnumValue,
} from "../../../src/shared/lib/formatters";

describe("shared formatters", () => {
  it("formats network and provider names", () => {
    expect(formatNetworkName("ethereum")).toBe("Ethereum");
    expect(formatNetworkName("arbitrum-one")).toBe("Arbitrum One");
    expect(formatBorrowProviderName("Morpho Blue Borrow")).toBe("Morpho Blue");
    expect(formatBorrowProviderName("Aave V3")).toBe("Aave V3");
  });

  it("humanizes enum-like values", () => {
    expect(humanizeEnumValue("block")).toBe("Block");
    expect(humanizeEnumValue("WITHDRAWAL_REQUEST")).toBe("Withdrawal Request");
    expect(humanizeEnumValue("FOO__BAR")).toBe("Foo Bar");
  });
});
