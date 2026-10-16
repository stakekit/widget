import { describe, expect, it } from "vitest";
import {
  BorrowFlowAmountRows,
  BorrowFlowOriginationRows,
} from "../../../src/features/borrow-transaction-flow/ui/summary-rows";
import {
  type WidgetPresentation,
  WidgetPresentationProvider,
} from "../../../src/shared/ui/widget-presentation";
import { render } from "../../utils/test-utils.dom.tsx";

const presentation = (locale: string): WidgetPresentation => ({
  disableInputAutoResize: false,
  hideNetworkLogo: false,
  hostTokenIconMapping: false,
  locale,
  mapNetworkIconUrl: () => undefined,
  mapTokenIconUrl: () => undefined,
  portalContainer: undefined,
  variant: "default",
});

// French groups digits with U+202F and uses a decimal comma.
const nnbsp = "\u202f";

describe("Borrow flow summary rows", () => {
  it("rounds moved amounts down and owed amounts up with the Widget language separators", async () => {
    const app = await render(
      <WidgetPresentationProvider value={presentation("fr")}>
        <BorrowFlowAmountRows
          action="borrow"
          projected={{
            borrow: { amount: "12345.678", symbol: "USDC" },
            collateral: { amount: "1000.5", symbol: "cbBTC" },
          }}
        />
        <BorrowFlowOriginationRows
          origination={{
            feeAmount: "1234.501",
            feeUsd: null,
            principalAmount: "13579.001",
            symbol: "USDC",
          }}
        />
      </WidgetPresentationProvider>
    );
    const text = app.container.textContent;

    expect(text).toContain(`12${nnbsp}345,67 USDC`);
    expect(text).toContain(`1${nnbsp}000,5 cbBTC`);
    expect(text).toContain(`1${nnbsp}234,51 USDC`);
    expect(text).toContain(`13${nnbsp}579,01 USDC`);
  });
});
