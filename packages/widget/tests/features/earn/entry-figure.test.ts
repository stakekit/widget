import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";
import { formatEntryFigure } from "../../../src/features/earn/ui/components/select-yield-section/entry-figure";

describe("formatEntryFigure", () => {
  it("reads unavailable before the user enters an amount", () => {
    expect(
      formatEntryFigure({
        amount: new BigNumber(0),
        amountEntered: false,
        locale: "en",
      })
    ).toBe("—");
  });

  it("shows the computed figure once an amount is entered, even 0", () => {
    expect(
      formatEntryFigure({
        amount: new BigNumber(0),
        amountEntered: true,
        locale: "en",
      })
    ).toBe("0");
    expect(
      formatEntryFigure({
        amount: new BigNumber("1.5"),
        amountEntered: true,
        locale: "en",
      })
    ).toBe("1.5");
  });

  it("reads unavailable for a figure that cannot be computed", () => {
    expect(
      formatEntryFigure({ amount: null, amountEntered: true, locale: "en" })
    ).toBe("—");
  });

  it("appends the unit only to a computed figure", () => {
    expect(
      formatEntryFigure({
        amount: new BigNumber("1.5"),
        amountEntered: true,
        locale: "en",
        unit: "stETH",
      })
    ).toBe("1.5 stETH");
    expect(
      formatEntryFigure({
        amount: new BigNumber("1.5"),
        amountEntered: false,
        locale: "en",
        unit: "stETH",
      })
    ).toBe("—");
    expect(
      formatEntryFigure({
        amount: null,
        amountEntered: true,
        locale: "en",
        unit: "stETH",
      })
    ).toBe("—");
  });
});
