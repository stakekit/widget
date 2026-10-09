import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ClassicTransactionStepState } from "../../src/features/classic-transaction-flow/model/classic-transaction-workflow";
import { TxState } from "../../src/features/classic-transaction-flow/ui/steps/pages/tx-state";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import { yieldApiActionFixture, yieldApiTransactionFixture } from "../fixtures";
import { TestWidgetConfigProvider } from "../utils/widget-config-provider";

const i18nInstance = createWidgetI18nInstance();
const action = yieldApiActionFixture();

const renderTxState = (state: ClassicTransactionStepState) =>
  render(
    <I18nextProvider i18n={i18nInstance}>
      <TestWidgetConfigProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        variant="default"
      >
        <TxState
          count={{ current: 1, total: 1 }}
          position="SINGLE"
          txState={{
            meta: {
              broadcasted: null,
              confirmationError: null,
              done: false,
              signError: null,
              signedTx: null,
              submissionIndex: null,
              url: null,
            },
            state,
            tx: yieldApiTransactionFixture(),
          }}
          yieldId={action.yieldId}
        />
      </TestWidgetConfigProvider>
    </I18nextProvider>
  );

const circleStates = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll('[data-rk="tx-state-step-circle"]'),
    (circle) => circle.getAttribute("data-state")
  );

const S = "success";
const P = "pending";

describe("Classic transaction step circles", () => {
  it.each([
    [ClassicTransactionStepState.SIGN_ERROR, [S, P, P, P]],
    [ClassicTransactionStepState.SIGN_LOADING, [S, P, P, P]],
    [ClassicTransactionStepState.SIGN_SUCCESS, [S, S, P, P]],
    [ClassicTransactionStepState.BROADCAST_ERROR, [S, S, P, P]],
    [ClassicTransactionStepState.BROADCAST_LOADING, [S, S, P, P]],
    [ClassicTransactionStepState.BROADCAST_SUCCESS, [S, S, S, P]],
    [ClassicTransactionStepState.CHECK_TX_STATUS_ERROR, [S, S, S, P]],
    [ClassicTransactionStepState.CHECK_TX_STATUS_LOADING, [S, S, S, P]],
    [ClassicTransactionStepState.CHECK_TX_STATUS_SUCCESS, [S, S, S, S]],
  ])("activates circles for state %i", async (state, expected) => {
    const app = await renderTxState(state);

    await expect.poll(() => circleStates(app.container)).toEqual(expected);

    await app.unmount();
  });

  it("keeps every circle pending before signing starts", async () => {
    const app = await renderTxState(ClassicTransactionStepState.SIGN_IDLE);

    await userEvent.click(app.getByText(/^Transaction - /));

    await expect.poll(() => circleStates(app.container)).toEqual([P, P, P, P]);

    await app.unmount();
  });
});
