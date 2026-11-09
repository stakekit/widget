import { describe, expect, it } from "vitest";

import { exactDecimal } from "../../../src/domain/finance/exact";
import { toPositionTotalDisplay } from "../../../src/features/portfolio/model/positions";
import { yieldApiYieldFixture } from "../../fixtures";

const token = yieldApiYieldFixture().token;
const sum = (amount: string, amountUsd: string, symbol: string) => ({
  amount: exactDecimal(amount),
  amountUsd: exactDecimal(amountUsd),
  token: { ...token, symbol },
});

describe("Manage row total", () => {
  it("shows one sum in its token beside its USD value", () => {
    const display = toPositionTotalDisplay([sum("4", "8", "USDC")]);

    expect(display.amount?.amount.toFixed()).toBe("4");
    expect(display.amount?.token.symbol).toBe("USDC");
    expect(display.amountUsd?.toFixed()).toBe("8");
  });

  it("shows several sums as their USD total only", () => {
    const display = toPositionTotalDisplay([
      sum("5", "5", "USDC"),
      sum("1000", "0", "FOO"),
    ]);

    expect(display.amount).toBeNull();
    expect(display.amountUsd?.toFixed()).toBe("5");
  });

  it("shows no USD value when unpriced", () => {
    expect(toPositionTotalDisplay([sum("4", "0", "FOO")]).amountUsd).toBeNull();
    expect(toPositionTotalDisplay([])).toEqual({
      amount: null,
      amountUsd: null,
    });
  });
});
