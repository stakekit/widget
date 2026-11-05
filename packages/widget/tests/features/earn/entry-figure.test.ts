import BigNumber from "bignumber.js";
import { describe, expect, it } from "vitest";
import { formatEntryFigure } from "../../../src/features/earn/ui/components/select-yield-section/entry-figure";
import { unavailableFigure } from "../../../src/shared/lib/number-format";

describe("formatEntryFigure", () => {
  it("reads unavailable before the user enters an amount", () => {
    expect(
      formatEntryFigure({
        amount: new BigNumber(0),
        amountEntered: false,
        locale: "en",
      })
    ).toBe(unavailableFigure);
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
    ).toBe(unavailableFigure);
  });
});
