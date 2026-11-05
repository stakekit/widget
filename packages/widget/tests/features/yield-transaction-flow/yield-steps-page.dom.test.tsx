import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { TransactionHash } from "../../../src/domain/identity/identifiers";
import type { PageCta } from "../../../src/features/widget-shell/views";
import type { YieldStepRow } from "../../../src/features/yield-transaction-flow/model/yield-transaction-workflow";
import { StepsPage } from "../../../src/features/yield-transaction-flow/ui/steps/pages/common.page";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { render } from "../../utils/test-utils.dom";
import { TestWidgetConfigProvider } from "../../utils/widget-config-provider";

type StepsMock = {
  cta?: PageCta;
  numbered: boolean;
  retry?: () => void;
  summary?: { title: string; detail?: string; token: { name: string } };
  txStates: ReadonlyArray<YieldStepRow>;
};

const steps = vi.hoisted(() => ({
  current: { numbered: true, txStates: [] } as StepsMock,
}));

vi.mock(
  "../../../src/features/yield-transaction-flow/ui/steps/hooks/use-steps.hook",
  () => ({
    useSteps: () => ({
      cancelled: false,
      cta: steps.current.cta ?? null,
      customSignErrorMessage: undefined,
      leaveConfirmationDialog: {
        onLeave: () => {},
        onStay: () => {},
        open: false,
      },
      numbered: steps.current.numbered,
      retry: steps.current.retry,
      summary: steps.current.summary ?? null,
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
  explorerUrl: null,
  hash: null,
  id: type,
  phases: idle,
  rejected: false,
  type,
});

const renderSteps = async (mock: StepsMock) => {
  steps.current = mock;
  const app = await render(
    <I18nextProvider i18n={i18n}>
      <TestWidgetConfigProvider apiKey="test-key" variant="default">
        <StepsPage />
      </TestWidgetConfigProvider>
    </I18nextProvider>
  );
  await expect
    .poll(() => app.container.querySelectorAll("li").length)
    .toBe(mock.txStates.length);
  return app;
};

const stepLabels = async (numbered: boolean) => {
  const app = await renderSteps({
    numbered,
    txStates: [row("ENCRYPT"), row("DEPOSIT")],
  });
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

const hash = TransactionHash.make(
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
);

describe("Yield Steps page progress", () => {
  it("heads the steps with the action and counts the confirmed ones", async () => {
    const app = await renderSteps({
      numbered: true,
      summary: {
        detail: "via Lido",
        title: "Stake 0.01 ETH",
        token: { name: "ETH" },
      },
      txStates: [
        {
          ...row("APPROVAL"),
          done: true,
          explorerUrl: "https://etherscan.io/tx/0x1",
          hash,
        },
        { ...row("STAKE"), phases: { ...idle, sign: "active" } },
      ],
    });

    const text = app.container.textContent ?? "";
    expect(text).toContain("Stake 0.01 ETH");
    expect(text).toContain("via Lido");
    expect(text).toContain("1 of 2 confirmed");
    const [approve, stake] = app.container.querySelectorAll("li");
    expect(approve?.textContent).toContain("Confirmed");
    expect(stake?.textContent).toContain("Waiting for signature");
    const link = approve?.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://etherscan.io/tx/0x1");
    expect(link?.textContent).toContain("View transaction, 0x1234\u2026cdef");
    app.unmount();
  });

  it("links a sent transaction only once it is confirmed", async () => {
    const app = await renderSteps({
      numbered: true,
      txStates: [
        {
          ...row("STAKE"),
          explorerUrl: "https://etherscan.io/tx/0x1",
          hash,
          phases: { broadcast: "done", confirm: "active", sign: "done" },
        },
      ],
    });

    const [stake] = app.container.querySelectorAll("li");
    expect(stake?.textContent).toContain("In progress");
    expect(stake?.querySelector("a")).toBeNull();
    expect(stake?.textContent).not.toContain("0x1234\u2026cdef");
    app.unmount();
  });

  it("retries from the footer, above Cancel, keeping the failure on its step", async () => {
    const retry = vi.fn();
    const app = await renderSteps({
      cta: {
        disabled: false,
        isLoading: false,
        label: "Cancel",
        onClick: () => {},
        variant: "secondary",
      },
      numbered: true,
      retry,
      txStates: [{ ...row("STAKE"), phases: { ...idle, sign: "failed" } }],
    });

    const [stake] = app.container.querySelectorAll("li");
    expect(stake?.textContent).toContain("Failed");
    expect(stake?.textContent).toContain("Something went wrong");
    expect(stake?.querySelector("button")).toBeNull();

    // In document order: the steps, then Try Again, then Cancel.
    const order = [...app.container.querySelectorAll("ol, button")].map(
      (element) => (element.tagName === "OL" ? "steps" : element.textContent)
    );
    expect(order.slice(-3)).toEqual(["steps", "Try Again", "Cancel"]);
    const button = app.container.querySelector<HTMLButtonElement>(
      '[data-rk="footer-button-primary"]'
    );
    expect(button?.textContent).toBe("Try Again");
    button?.click();
    expect(retry).toHaveBeenCalledOnce();
    app.unmount();
  });
});
