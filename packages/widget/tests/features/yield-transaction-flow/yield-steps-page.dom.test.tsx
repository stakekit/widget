import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import {
  TransactionHash,
  TransactionWorkflowId,
} from "../../../src/domain/identity/identifiers";
import type { PageCta } from "../../../src/features/widget-shell/views";
import type { YieldStepRow } from "../../../src/features/yield-transaction-flow/model/yield-transaction-workflow";
import { StepsPage } from "../../../src/features/yield-transaction-flow/ui/steps/pages/common.page";
import {
  makeTransactionSignError,
  TransactionConfirmationError,
  type TransactionWorkflowError,
} from "../../../src/services/transaction-workflow/transaction-workflow-model";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { ExternalProviderError } from "../../../src/services/wallet/external-provider";
import { WalletSigningError } from "../../../src/services/wallet/wallet-errors";
import { render } from "../../utils/test-utils.dom";
import { TestWidgetConfigProvider } from "../../utils/widget-config-provider";

type StepsMock = {
  cta?: PageCta;
  details?: ReadonlyArray<{ label: string; value: string; caption?: string }>;
  error?: TransactionWorkflowError;
  numbered: boolean;
  retry?: () => void;
  summary?: { title: string; detail?: string; token: { name: string } };
  txStates: ReadonlyArray<YieldStepRow>;
  wallet?: { name: string; logo?: string } | null;
};

const steps = vi.hoisted(() => ({
  current: { numbered: true, txStates: [] } as StepsMock,
}));

vi.mock(
  "../../../src/features/yield-transaction-flow/ui/steps/hooks/use-steps.hook",
  () => ({
    useSteps: () => ({
      cta: steps.current.cta ?? null,
      error: steps.current.error ?? null,
      leaveConfirmationDialog: {
        onLeave: () => {},
        onStay: () => {},
        open: false,
        resumable: false,
      },
      numbered: steps.current.numbered,
      retry: steps.current.retry,
      summary: steps.current.summary ?? null,
      txStates: steps.current.txStates,
      details: steps.current.details ?? [],
      wallet: steps.current.wallet ?? null,
      yieldId: "zama-vault",
    }),
  })
);
vi.mock("../../../src/features/widget-shell/ui/use-header", () => ({
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

    expect(labels[0]).toContain("Step 1 of 2 · ");
    expect(labels[1]).toContain("Step 2 of 2 · Deposit");
  });

  it("omits the count when unnumbered", async () => {
    const labels = await stepLabels(false);

    expect(labels[0]).toMatch(/^Encrypt amount/);
    expect(labels[1]).toMatch(/^Deposit/);
    expect(labels.join(" ")).not.toContain("Step ");
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
    expect(link?.textContent).toContain("View on explorer");
    expect(approve?.textContent).toContain("0x1234\u2026cdef");
    app.unmount();
  });

  it("links a transaction as soon as it is broadcast", async () => {
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
    expect(stake?.querySelector("a")?.getAttribute("href")).toBe(
      "https://etherscan.io/tx/0x1"
    );
    expect(stake?.textContent).toContain("0x1234\u2026cdef");
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
      error: makeTransactionSignError({
        batchId: "batch",
        network: "ethereum",
        reason: { _tag: "WalletRequestCancelled", operation: "transaction" },
        transactionId: null,
        workflowId: TransactionWorkflowId.make("w"),
      }),
      numbered: true,
      retry,
      txStates: [{ ...row("STAKE"), phases: { ...idle, sign: "failed" } }],
    });

    const [stake] = app.container.querySelectorAll("li");
    expect(stake?.textContent).toContain("Cancelled in wallet");
    expect(stake?.textContent).not.toContain("Failed");
    expect(stake?.textContent).toContain(
      "Nothing was sent. Try again when you're ready."
    );
    expect(stake?.querySelector("button")).toBeNull();

    // In document order: the steps, then Try again, then Cancel.
    const order = [...app.container.querySelectorAll("ol, button")].map(
      (element) => (element.tagName === "OL" ? "steps" : element.textContent)
    );
    expect(order.slice(-3)).toEqual(["steps", "Try again", "Cancel"]);
    const button = app.container.querySelector<HTMLButtonElement>(
      '[data-rk="footer-button-primary"]'
    );
    expect(button?.textContent).toBe("Try again");
    button?.click();
    expect(retry).toHaveBeenCalledOnce();
    app.unmount();
  });

  it("says a wallet failure plainly, keeping the wallet's words as a detail", async () => {
    const app = await renderSteps({
      error: makeTransactionSignError({
        batchId: "batch",
        network: "ethereum",
        reason: {
          _tag: "WalletOperationFailed",
          cause: new WalletSigningError({
            cause: new ExternalProviderError({
              customMessage: "Playground: scripted wallet failure",
              message: "Playground: scripted wallet failure",
            }),
            operation: "transaction",
          }),
          operation: "transaction",
        },
        transactionId: null,
        workflowId: TransactionWorkflowId.make("w"),
      }),
      numbered: true,
      txStates: [{ ...row("STAKE"), phases: { ...idle, sign: "failed" } }],
    });

    const [stake] = app.container.querySelectorAll("li");
    expect(stake?.textContent).toContain(
      "Your wallet couldn't complete the request. Try again. Details: Playground: scripted wallet failure"
    );
    expect(app.container.querySelector('[role="alert"]')).toBeNull();
    app.unmount();
  });

  it("links a transaction that failed on chain, naming why", async () => {
    const app = await renderSteps({
      error: new TransactionConfirmationError({
        batchId: "batch",
        message: "Transaction ended with FAILED status.",
        network: "ethereum",
        outcome: "Failed",
        reason: "execution reverted: insufficient allowance",
        transactionId: null,
        workflowId: TransactionWorkflowId.make("w"),
      }),
      numbered: true,
      txStates: [
        {
          ...row("STAKE"),
          explorerUrl: "https://etherscan.io/tx/0x1",
          hash,
          phases: { broadcast: "done", confirm: "failed", sign: "done" },
        },
      ],
    });

    const [stake] = app.container.querySelectorAll("li");
    expect(stake?.textContent).toContain(
      "The transaction failed on chain: insufficient allowance."
    );
    expect(stake?.textContent).not.toContain("FAILED status");
    expect(stake?.querySelector("a")?.getAttribute("href")).toBe(
      "https://etherscan.io/tx/0x1"
    );
    app.unmount();
  });

  it("asks to approve the signing transaction in the wallet, then lists the details", async () => {
    const app = await renderSteps({
      details: [
        { caption: "$24.20", label: "Amount", value: "0.01 ETH" },
        { label: "Estimated gas", value: "0.0002 ETH" },
      ],
      numbered: true,
      txStates: [
        { ...row("APPROVAL"), done: true },
        { ...row("STAKE"), phases: { ...idle, sign: "active" } },
      ],
      wallet: { name: "MetaMask" },
    });

    const prompt = app.container.querySelector(
      '[data-testid="flow-steps-signature-prompt"]'
    );
    expect(prompt?.textContent).toContain("Check your wallet");
    expect(prompt?.textContent).toContain(
      "Approve the Stake transaction in MetaMask"
    );
    const details = app.container.querySelector(
      '[data-testid="flow-steps-details"]'
    );
    expect(details?.textContent).toContain("Amount0.01 ETH$24.20");
    expect(details?.textContent).toContain("Estimated gas0.0002 ETH");
    app.unmount();
  });

  it("names no wallet it does not know, and asks nothing once no step signs", async () => {
    const signing = await renderSteps({
      numbered: true,
      txStates: [{ ...row("STAKE"), phases: { ...idle, sign: "active" } }],
    });
    expect(signing.container.textContent).toContain(
      "Approve the Stake transaction in your wallet"
    );
    signing.unmount();

    const sending = await renderSteps({
      numbered: true,
      txStates: [
        {
          ...row("STAKE"),
          phases: { broadcast: "active", confirm: "idle", sign: "done" },
        },
      ],
      wallet: { name: "MetaMask" },
    });
    expect(sending.container.textContent).not.toContain("Check your wallet");
    expect(
      sending.container.querySelector('[data-testid="flow-steps-details"]')
    ).toBeNull();
    sending.unmount();
  });
});
