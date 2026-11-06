import { describe, expect, it } from "vitest";
import {
  getBorrowFlowCollateralAmountRow,
  getBorrowFlowOriginationRows,
  getBorrowFlowPositionChangeRows,
} from "../../../src/features/borrow-transaction-flow/ui/summary-rows";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";

const i18n = createWidgetI18nInstance();
const t = i18n.getFixedT("en");

// French groups digits with U+202F and uses a decimal comma.
const nnbsp = "\u202f";

describe("Borrow flow summary rows", () => {
  it("rounds moved amounts down and owed amounts up with the Widget language separators", () => {
    const collateral = getBorrowFlowCollateralAmountRow({
      collateral: { amount: "1000.5", symbol: "cbBTC" },
      locale: "fr",
      t,
    });
    const origination = getBorrowFlowOriginationRows({
      locale: "fr",
      origination: {
        feeAmount: "1234.50001",
        feeUsd: null,
        principalAmount: "13579.00001",
        symbol: "USDC",
      },
      t,
    });

    expect(collateral.value).toBe(`1${nnbsp}000,5 cbBTC`);
    expect(origination?.fee.value).toBe(`1${nnbsp}234,5001 USDC`);
    expect(origination?.principal.value).toBe(`13${nnbsp}579,0001 USDC`);
  });

  it("opens no origination rows for an action without debt", () => {
    expect(
      getBorrowFlowOriginationRows({ locale: "en", origination: null, t })
    ).toBeNull();
  });

  it("tones a health factor below 1 as danger", () => {
    const rows = getBorrowFlowPositionChangeRows({
      change: {
        collateralUsd: null,
        debtUsd: null,
        healthFactor: { after: "0.95", before: "2.5" },
        ltv: null,
        maxLtv: null,
      },
      locale: "en",
      t,
    });

    expect(rows).toEqual([
      expect.objectContaining({ label: "Health factor", tone: "danger" }),
    ]);
  });

  it("reads the health factor before and after even when both round alike", () => {
    const rows = getBorrowFlowPositionChangeRows({
      change: {
        collateralUsd: null,
        debtUsd: null,
        healthFactor: { after: "2.3723", before: "2.3701" },
        ltv: null,
        maxLtv: null,
      },
      locale: "en",
      t,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        label: "Health factor",
        value: "2.37 → 2.37",
      }),
    ]);
  });

  it("reads the LTV, its meter and the health factor in one band", () => {
    const rows = getBorrowFlowPositionChangeRows({
      change: {
        collateralUsd: null,
        debtUsd: null,
        healthFactor: { after: "1.3", before: "2.5" },
        ltv: { after: "0.4", before: "0.2" },
        maxLtv: "0.8",
      },
      locale: "en",
      t,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        label: "LTV",
        tone: "warning",
        meter: {
          value: 40,
          valueText: "40%",
          marker: { value: 80, label: "Max LTV 80%" },
        },
      }),
      expect.objectContaining({ label: "Health factor", tone: "warning" }),
    ]);
  });

  it("reads a safe position's figures plain with a meter, and a closed one's with none", () => {
    const safe = getBorrowFlowPositionChangeRows({
      change: {
        collateralUsd: null,
        debtUsd: null,
        healthFactor: { after: "2.1", before: null },
        ltv: { after: "0.4", before: null },
        maxLtv: "0.8",
      },
      locale: "en",
      t,
    });
    const closed = getBorrowFlowPositionChangeRows({
      change: {
        collateralUsd: null,
        debtUsd: null,
        healthFactor: null,
        ltv: { after: "0", before: "0.4" },
        maxLtv: "0.8",
      },
      locale: "en",
      t,
    });

    // Safe reads plain: green is for positive rates and claimable amounts.
    expect(safe.map((row) => row.tone)).toEqual([undefined, undefined]);
    expect(safe[0]?.meter).toEqual(expect.objectContaining({ value: 40 }));
    expect(closed).toEqual([
      expect.not.objectContaining({ tone: expect.anything() }),
    ]);
    expect(closed[0]?.meter).toBeUndefined();
  });
});
