import { act } from "react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RichError } from "../../../src/services/errors/rich-error";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { render } from "../../utils/test-utils.dom";

const richErrorState = vi.hoisted(
  (): {
    error: RichError | null;
    resetError: ReturnType<typeof vi.fn>;
    retry: (() => void) | null;
  } => ({
    error: null,
    resetError: vi.fn(),
    retry: null,
  })
);

vi.mock("../../../src/features/widget-shell/ui/use-rich-errors", () => ({
  useRichErrors: () => richErrorState,
}));

import { RichErrorModal } from "../../../src/features/widget-shell/ui/rich-error-modal";

const renderModal = () =>
  render(
    <I18nextProvider i18n={createWidgetI18nInstance()}>
      <RichErrorModal />
    </I18nextProvider>
  );

describe("RichErrorModal", () => {
  afterEach(() => {
    richErrorState.error = null;
    richErrorState.retry = null;
    richErrorState.resetError.mockClear();
  });

  it("offers Try again before the dismiss action when the work can run again", async () => {
    const retry = vi.fn();
    richErrorState.error = { message: "ApiUnreachableError" };
    richErrorState.retry = retry;
    await renderModal();

    const labels = [...document.querySelectorAll("button")].map(
      (button) => button.textContent
    );
    expect(labels.indexOf("Try again")).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf("Try again")).toBeLessThan(labels.indexOf("Got it"));

    await act(async () =>
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent === "Try again")
        ?.click()
    );
    expect(retry).toHaveBeenCalledOnce();
  });

  it("offers no Try again when the work cannot run again", async () => {
    richErrorState.error = { message: "ApiUnreachableError" };
    await renderModal();

    expect(document.body.textContent).toContain("Got it");
    expect(document.body.textContent).not.toContain("Try again");
  });

  it("renders English Error Copy details instead of the API reason", async () => {
    richErrorState.error = {
      message: "KaminoLendingInsufficientSolForRentError",
      details: {
        reason:
          "Insufficient SOL for transaction. Required: ~0.005 SOL, Current: 0.004 SOL",
      },
    };

    await renderModal();

    expect(document.body.textContent).toContain(
      "Insufficient SOL for account rent"
    );
    expect(document.body.textContent).toContain(
      "There is not enough SOL to fund the account rent required by Kamino Lending"
    );
    expect(document.body.textContent).toContain("How to fix it");
    expect(document.body.textContent).toContain(
      "Add SOL to the account and try again"
    );
    expect(document.body.textContent).not.toContain(
      "Insufficient SOL for transaction. Required: ~0.005 SOL, Current: 0.004 SOL"
    );
    expect(document.body.textContent).not.toContain(
      "KaminoLendingInsufficientSolForRentError"
    );
  });

  it("announces the Error Copy details as the dialog's description", async () => {
    richErrorState.error = { message: "MinimumAmountNotReachedError" };
    await renderModal();

    const dialog = document.querySelector("[role='dialog']");
    const description = document.getElementById(
      dialog?.getAttribute("aria-describedby") ?? ""
    );
    expect(description?.textContent).toBe(
      "The amount is below the minimum required for this operation"
    );
  });

  it("interpolates values explicitly referenced by host Error Copy", async () => {
    const i18n = createWidgetI18nInstance();
    i18n.addResourceBundle(
      "en",
      "translation",
      {
        errors: {
          KaminoLendingInsufficientSolForRentError: {
            details: "The account needs {{amount}} for rent",
          },
        },
      },
      true,
      true
    );
    richErrorState.error = {
      message: "KaminoLendingInsufficientSolForRentError",
      details: {
        amount: "0.005 SOL",
        reason: "Internal provider payload",
      },
    };

    await render(
      <I18nextProvider i18n={i18n}>
        <RichErrorModal />
      </I18nextProvider>
    );

    expect(document.body.textContent).toContain(
      "The account needs 0.005 SOL for rent"
    );
    expect(document.body.textContent).not.toContain(
      "Internal provider payload"
    );
  });

  it("does not interpolate reason when host Error Copy references it", async () => {
    const i18n = createWidgetI18nInstance();
    i18n.addResourceBundle(
      "en",
      "translation",
      {
        errors: {
          KaminoLendingInsufficientSolForRentError: {
            details: "Provider reason: {{reason}}",
          },
        },
      },
      true,
      true
    );
    richErrorState.error = {
      message: "KaminoLendingInsufficientSolForRentError",
      details: { reason: "Internal provider payload" },
    };

    await render(
      <I18nextProvider i18n={i18n}>
        <RichErrorModal />
      </I18nextProvider>
    );

    expect(document.body.textContent).not.toContain(
      "Internal provider payload"
    );
  });

  // An unknown error still says what to do next and how to dismiss it: the
  // sheet never shows a bare title.
  it("renders the generic copy and a dismiss action for an unknown English identity", async () => {
    richErrorState.error = {
      message: "FutureApiError",
      details: { reason: "The operation is temporarily unavailable." },
    };
    await renderModal();

    expect(document.body.textContent?.trim()).toBe(
      "Something went wrongWe couldn't complete that request. Try again in a moment.Got it"
    );
    expect(document.body.textContent).not.toContain(
      "The operation is temporarily unavailable."
    );
    expect(document.body.textContent).not.toContain("FutureApiError");

    await act(async () =>
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent === "Got it")
        ?.click()
    );
    expect(richErrorState.resetError).toHaveBeenCalled();
  });

  it("treats incomplete catalog copy as unknown and hides the identity", async () => {
    const i18n = createWidgetI18nInstance();
    i18n.addResourceBundle(
      "en",
      "translation",
      { errors: { FutureApiError: { title: "Only a title" } } },
      true,
      true
    );
    richErrorState.error = {
      message: "FutureApiError",
      details: { reason: "The operation is temporarily unavailable." },
    };
    await render(
      <I18nextProvider i18n={i18n}>
        <RichErrorModal />
      </I18nextProvider>
    );

    expect(document.body.textContent).toContain("Something went wrong");
    expect(document.body.textContent).not.toContain(
      "The operation is temporarily unavailable."
    );
    expect(document.body.textContent).not.toContain("FutureApiError");
    expect(document.body.textContent).not.toContain("Only a title");
    expect(document.body.textContent).not.toContain(
      "errors.FutureApiError.details"
    );
  });
});
