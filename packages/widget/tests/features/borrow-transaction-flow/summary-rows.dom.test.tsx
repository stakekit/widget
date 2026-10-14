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
  it("shows exact amounts with the Widget language separators", async () => {
    const app = await render(
      <WidgetPresentationProvider value={presentation("fr")}>
        <BorrowFlowAmountRows
          action="borrow"
          projected={{
            borrow: { amount: "12345.000000000000000001", symbol: "USDC" },
            collateral: { amount: "1000.5", symbol: "cbBTC" },
          }}
        />
        <BorrowFlowOriginationRows
          origination={{
            feeAmount: "1234.5",
            feeUsd: null,
            principalAmount: "13579.000000000000000001",
            symbol: "USDC",
          }}
        />
      </WidgetPresentationProvider>
    );
    const text = app.container.textContent;

    expect(text).toContain(`12${nnbsp}345,000000000000000001 USDC`);
    expect(text).toContain(`1${nnbsp}000,5 cbBTC`);
    expect(text).toContain(`1${nnbsp}234,5 USDC`);
    expect(text).toContain(`13${nnbsp}579,000000000000000001 USDC`);
  });
});
