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
});
