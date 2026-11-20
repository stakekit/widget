import { describe, expect, it } from "vitest";

import {
  formatBorrowProviderName,
  formatHealthFactor,
  formatLtv,
} from "../../../src/features/borrow-presentation/index";

// French separators: U+00A0 precedes `%` and compact suffixes.
const nbsp = "\u00a0";

describe("formatBorrowProviderName", () => {
  it("drops a trailing Borrow", () => {
    expect(formatBorrowProviderName("Morpho Blue Borrow")).toBe("Morpho Blue");
    expect(formatBorrowProviderName("Aave V3")).toBe("Aave V3");
  });
});

describe("formatLtv", () => {
  it.each([
    ["en", null, "—"],
    ["en", 0.4132, "41.32%"],
    ["en", 1, "100%"],
    ["en", 1.0001, ">100%"],
    ["en", 4116.7807, ">100%"],
    ["fr", 0.4132, `41,32${nbsp}%`],
    ["fr", 1.0001, `>100${nbsp}%`],
  ] as const)("formats %s LTV %s as %s", (locale, value, expected) => {
    expect(formatLtv(value, locale)).toBe(expected);
  });
});

describe("formatHealthFactor", () => {
  it.each([
    ["en", 0, "0"],
    ["en", 0.0001, "<0.01"],
    ["en", 0.0099, "<0.01"],
    ["en", 0.01, "0.01"],
    ["en", 0.9996, "0.99"],
    ["en", 4.0828, "4.08"],
    ["en", 999.99999, "999.99"],
    ["en", 1000, "1K"],
    ["en", 2_228_355.9814, "2.22M"],
    ["en", "999999.999999999999", "999.99K"],
    ["en", null, "—"],
    ["fr", 0.0001, "<0,01"],
    ["fr", 4.0828, "4,08"],
    ["fr", 1234.5, `1,23${nbsp}k`],
  ] as const)(
    "formats %s health factor %s as %s",
    (locale, value, expected) => {
      expect(formatHealthFactor(value, locale)).toBe(expected);
    }
  );
});
