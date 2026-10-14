import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { createWidgetI18nInstance } from "../../../../src/services/translation/widget-translation";
import {
  getTransactionStepPhases,
  type TransactionStepPhaseStatus,
  TransactionSteps,
} from "../../../../src/shared/ui/components/transaction-steps";
import { TestWidgetConfigProvider } from "../../../utils/widget-config-provider";

const i18nInstance = createWidgetI18nInstance();

const renderStep = (
  sign: TransactionStepPhaseStatus,
  broadcast: TransactionStepPhaseStatus,
  confirm: TransactionStepPhaseStatus
) =>
  render(
    <I18nextProvider i18n={i18nInstance}>
      <TestWidgetConfigProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        variant="default"
      >
        <TransactionSteps
          steps={[
            {
              done: false,
              id: "tx-1",
              phases: getTransactionStepPhases(i18nInstance.t, {
                broadcast,
                confirm,
                sign,
              }),
              type: "STAKE",
            },
          ]}
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
    ["failed", "idle", "idle", [S, P, P, P]],
    ["active", "idle", "idle", [S, P, P, P]],
    ["done", "idle", "idle", [S, S, P, P]],
    ["done", "failed", "idle", [S, S, P, P]],
    ["done", "active", "idle", [S, S, P, P]],
    ["done", "done", "idle", [S, S, S, P]],
    ["done", "done", "failed", [S, S, S, P]],
    ["done", "done", "active", [S, S, S, P]],
    ["done", "done", "done", [S, S, S, S]],
  ] as const)(
    "activates circles for sign %s, broadcast %s, confirm %s",
    async (sign, broadcast, confirm, expected) => {
      const app = await renderStep(sign, broadcast, confirm);

      await expect.poll(() => circleStates(app.container)).toEqual(expected);

      await app.unmount();
    }
  );

  it("keeps every circle pending before signing starts", async () => {
    const app = await renderStep("idle", "idle", "idle");

    await userEvent.click(app.getByText(/^Transaction - /));

    await expect.poll(() => circleStates(app.container)).toEqual([P, P, P, P]);

    await app.unmount();
  });
});
