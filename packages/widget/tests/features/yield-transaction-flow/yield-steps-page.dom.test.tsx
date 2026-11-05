import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import type { YieldStepRow } from "../../../src/features/yield-transaction-flow/model/yield-transaction-workflow";
import { StepsPage } from "../../../src/features/yield-transaction-flow/ui/steps/pages/common.page";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { render } from "../../utils/test-utils.dom";
import { TestWidgetConfigProvider } from "../../utils/widget-config-provider";

const steps = vi.hoisted(() => ({
  current: { numbered: true, txStates: [] as ReadonlyArray<YieldStepRow> },
}));

vi.mock(
  "../../../src/features/yield-transaction-flow/ui/steps/hooks/use-steps.hook",
  () => ({
    useSteps: () => ({
      cancelled: false,
      cta: null,
      customSignErrorMessage: undefined,
      leaveConfirmationDialog: {
        onLeave: () => {},
        onStay: () => {},
        open: false,
      },
      numbered: steps.current.numbered,
      retry: undefined,
      txStates: steps.current.txStates,
      yieldId: "zama-vault",
    }),
  })
);
vi.mock("../../../src/features/widget-shell/react/use-header", () => ({
  useHeader: () => ({ onLeftIconPress: () => {} }),
}));

const i18n = createWidgetI18nInstance();

const idle = { broadcast: "idle", confirm: "idle", sign: "idle" } as const;

const row = (type: YieldStepRow["type"]): YieldStepRow => ({
  done: false,
  id: type,
  phases: idle,
  rejected: false,
  type,
});

const stepLabels = async (numbered: boolean) => {
  steps.current = {
    numbered,
    txStates: [row("ENCRYPT"), row("DEPOSIT")],
  };
  const app = await render(
    <I18nextProvider i18n={i18n}>
      <TestWidgetConfigProvider apiKey="test-key" variant="default">
        <StepsPage />
      </TestWidgetConfigProvider>
    </I18nextProvider>
  );
  await expect.poll(() => app.container.querySelectorAll("li").length).toBe(2);
  const labels = Array.from(app.container.querySelectorAll("li"), (item) =>
    item.textContent?.trim()
  );
  app.unmount();
  return labels;
};

describe("Yield Steps page headers", () => {
  it("counts the steps when numbered", async () => {
    const labels = await stepLabels(true);

    expect(labels[0]).toContain("Transaction 1 / 2 - ");
    expect(labels[1]).toContain("Transaction 2 / 2 - Deposit");
  });

  it("omits the count when unnumbered", async () => {
    const labels = await stepLabels(false);

    expect(labels[0]).toMatch(/^Transaction - /);
    expect(labels[1]).toContain("Transaction - Deposit");
    expect(labels.join(" ")).not.toContain(" / ");
  });
});
