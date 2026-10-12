import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import { TransactionStepState } from "../../src/shared/lib/transaction-step-state";
import { TransactionSteps } from "../../src/shared/ui/components/transaction-steps";
import { TestWidgetConfigProvider } from "../utils/widget-config-provider";

const i18nInstance = createWidgetI18nInstance();

const renderStep = (state: TransactionStepState) =>
  render(
    <I18nextProvider i18n={i18nInstance}>
      <TestWidgetConfigProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        variant="default"
      >
        <TransactionSteps
          steps={[{ done: false, id: "tx-1", state, type: "STAKE" }]}
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

describe("Transaction step circles", () => {
  it.each([
    [TransactionStepState.SIGN_ERROR, [S, P, P, P]],
    [TransactionStepState.SIGN_LOADING, [S, P, P, P]],
    [TransactionStepState.SIGN_SUCCESS, [S, S, P, P]],
    [TransactionStepState.BROADCAST_ERROR, [S, S, P, P]],
    [TransactionStepState.BROADCAST_LOADING, [S, S, P, P]],
    [TransactionStepState.BROADCAST_SUCCESS, [S, S, S, P]],
    [TransactionStepState.CHECK_TX_STATUS_ERROR, [S, S, S, P]],
    [TransactionStepState.CHECK_TX_STATUS_LOADING, [S, S, S, P]],
    [TransactionStepState.CHECK_TX_STATUS_SUCCESS, [S, S, S, S]],
  ])("activates circles for state %i", async (state, expected) => {
    const app = await renderStep(state);

    await expect.poll(() => circleStates(app.container)).toEqual(expected);

    await app.unmount();
  });

  it("keeps every circle pending before signing starts", async () => {
    const app = await renderStep(TransactionStepState.SIGN_IDLE);

    await userEvent.click(app.getByText(/^Transaction - /));

    await expect.poll(() => circleStates(app.container)).toEqual([P, P, P, P]);

    await app.unmount();
  });
});
