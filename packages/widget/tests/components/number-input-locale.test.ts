import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";
import {
  formatLocalizedNumber,
  isLocalizedNumberInput,
  parseLocalizedNumberInput,
} from "../../src/shared/ui/components/number-input/locale-number";

describe("localized number input", () => {
  it("uses English decimal and grouping separators without guessing", () => {
    expect(parseLocalizedNumberInput("0.123", "en")?.toFixed()).toBe("0.123");
    expect(parseLocalizedNumberInput("1,234.5", "en")?.toFixed()).toBe(
      "1234.5"
    );
    expect(isLocalizedNumberInput("0,123", "en")).toBe(false);
    expect(parseLocalizedNumberInput("0,123", "en")).toBeNull();
  });

  it("uses French decimal and whitespace grouping separators", () => {
    expect(parseLocalizedNumberInput("0,123", "fr")?.toFixed()).toBe("0.123");
    expect(parseLocalizedNumberInput("1 234,5", "fr")?.toFixed()).toBe(
      "1234.5"
    );
    expect(parseLocalizedNumberInput("1 234,5", "fr")?.toFixed()).toBe(
      "1234.5"
    );
    expect(isLocalizedNumberInput("1,234.5", "fr")).toBe(false);
  });

  it("formats grouped display and ungrouped editing values for each locale", () => {
    const value = new BigNumber("1234.5");

    expect(
      formatLocalizedNumber({ locale: "en", useGrouping: true, value })
    ).toBe("1,234.5");
    expect(
      formatLocalizedNumber({ locale: "fr", useGrouping: true, value })
    ).toBe("1 234,5");
    expect(
      formatLocalizedNumber({ locale: "fr", useGrouping: false, value })
    ).toBe("1234,5");
  });

  it("round-trips values without converting through JavaScript numbers", () => {
    const value = new BigNumber("9007199254740993.000000000000000001");
    const formatted = formatLocalizedNumber({
      locale: "fr",
      useGrouping: true,
      value,
    });

    expect(parseLocalizedNumberInput(formatted, "fr")?.isEqualTo(value)).toBe(
      true
    );
  });
});
