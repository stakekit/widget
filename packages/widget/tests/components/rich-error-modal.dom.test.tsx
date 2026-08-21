import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RichError } from "../../src/services/errors/rich-error";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import { render } from "../utils/test-utils.dom";

const richErrorState = vi.hoisted(
  (): {
    error: RichError | null;
    resetError: ReturnType<typeof vi.fn>;
  } => ({
    error: null,
    resetError: vi.fn(),
  })
);

vi.mock("../../src/features/widget-shell/react/use-rich-errors", () => ({
  useRichErrors: () => richErrorState,
}));

vi.mock("../../src/shared/ui/components/select-modal", () => ({
  SelectModal: ({
    children,
    state,
  }: {
    children: ReactNode;
    state: { isOpen: boolean };
  }) => (state.isOpen ? children : null),
}));

import { RichErrorModal } from "../../src/features/widget-shell/ui/rich-error-modal";

const renderModal = () =>
  render(
    <I18nextProvider i18n={createWidgetI18nInstance()}>
      <RichErrorModal />
    </I18nextProvider>
  );

describe("RichErrorModal", () => {
  afterEach(() => {
    richErrorState.error = null;
    richErrorState.resetError.mockClear();
  });

  it("renders local fallback copy for a missing remote identity", async () => {
    richErrorState.error = {
      message: "KaminoLendingInsufficientSolForRentError",
      details: { reason: "Technical API reason" },
    };

    await renderModal();

    expect(document.body.textContent).toContain(
      "Insufficient SOL for Account Rent"
    );
    expect(document.body.textContent).toContain(
      "There is not enough SOL to fund the account rent required by Kamino Lending"
    );
    expect(document.body.textContent).not.toContain("Technical API reason");
    expect(document.body.textContent).not.toContain(
      "KaminoLendingInsufficientSolForRentError"
    );
  });

  it("renders the API reason instead of an unknown identity", async () => {
    richErrorState.error = {
      message: "FutureApiError",
      details: { reason: "The operation is temporarily unavailable." },
    };
    await renderModal();

    expect(document.body.textContent).toContain("Something went wrong");
    expect(document.body.textContent).toContain(
      "The operation is temporarily unavailable."
    );
    expect(document.body.textContent).not.toContain("FutureApiError");
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
    expect(document.body.textContent).toContain(
      "The operation is temporarily unavailable."
    );
    expect(document.body.textContent).not.toContain("FutureApiError");
    expect(document.body.textContent).not.toContain("Only a title");
    expect(document.body.textContent).not.toContain(
      "errors.FutureApiError.details"
    );
  });

  it("renders a prose message that carries no reason", async () => {
    richErrorState.error = { message: "KYC required" };

    await renderModal();

    expect(document.body.textContent).toContain("Something went wrong");
    expect(document.body.textContent).toContain("KYC required");
  });

  it("renders only the generic title when an unknown error has no usable reason", async () => {
    richErrorState.error = {
      message: "FutureApiError",
      details: { reason: "   " },
    };

    await renderModal();

    expect(document.body.textContent).toContain("Something went wrong");
    expect(document.body.textContent).not.toContain("FutureApiError");
    expect(document.body.textContent?.trim()).toBe("Something went wrong");
  });
});
