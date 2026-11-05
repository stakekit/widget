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
  } => ({
    error: null,
    resetError: vi.fn(),
  })
);

vi.mock("../../../src/features/widget-shell/react/use-rich-errors", () => ({
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
    richErrorState.resetError.mockClear();
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
    expect(document.body.textContent).toContain("Potential solution:");
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

  it("keeps French Error Copy details instead of the English API reason", async () => {
    const i18n = createWidgetI18nInstance();
    await i18n.changeLanguage("fr");
    richErrorState.error = {
      message: "KaminoLendingInsufficientSolForRentError",
      details: {
        reason:
          "Insufficient SOL for transaction. Required: ~0.005 SOL, Current: 0.004 SOL",
      },
    };

    await render(
      <I18nextProvider i18n={i18n}>
        <RichErrorModal />
      </I18nextProvider>
    );

    expect(document.body.textContent).toContain(
      "SOL insuffisant pour le loyer du compte"
    );
    expect(document.body.textContent).toContain(
      "Le solde SOL est insuffisant pour financer le loyer de compte requis par Kamino Lending"
    );
    expect(document.body.textContent).not.toContain(
      "Insufficient SOL for transaction"
    );
  });

  it("renders host Error Copy details instead of the API reason", async () => {
    const i18n = createWidgetI18nInstance();
    i18n.addResourceBundle(
      "en",
      "translation",
      {
        errors: {
          KaminoLendingInsufficientSolForRentError: { details: "HOST DETAILS" },
        },
      },
      true,
      true
    );
    richErrorState.error = {
      message: "KaminoLendingInsufficientSolForRentError",
      details: { reason: "Insufficient SOL for transaction." },
    };

    await render(
      <I18nextProvider i18n={i18n}>
        <RichErrorModal />
      </I18nextProvider>
    );

    expect(document.body.textContent).toContain("HOST DETAILS");
    expect(document.body.textContent).not.toContain(
      "Insufficient SOL for transaction."
    );
    expect(document.body.textContent).toContain(
      "Add SOL to the account and try again"
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
  it("renders the generic French copy for an unknown identity", async () => {
    const i18n = createWidgetI18nInstance();
    await i18n.changeLanguage("fr");
    richErrorState.error = {
      message: "FutureApiError",
      details: { reason: "The operation is temporarily unavailable." },
    };

    await render(
      <I18nextProvider i18n={i18n}>
        <RichErrorModal />
      </I18nextProvider>
    );

    expect(document.body.textContent?.trim()).toBe(
      "Une erreur s'est produiteNous n'avons pas pu traiter cette demande. Réessayez dans un instant.Compris"
    );
  });

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

  it("treats a prose-shaped message as an unknown identity", async () => {
    richErrorState.error = { message: "KYC required" };

    await renderModal();

    expect(document.body.textContent).toContain("Something went wrong");
    expect(document.body.textContent).not.toContain("KYC required");
    expect(document.body.textContent).toContain(
      "We couldn't complete that request."
    );
  });

  it("renders the generic copy when an unknown error has no usable reason", async () => {
    richErrorState.error = {
      message: "FutureApiError",
      details: { reason: "   " },
    };

    await renderModal();

    expect(document.body.textContent).toContain("Something went wrong");
    expect(document.body.textContent).not.toContain("FutureApiError");
    expect(document.body.textContent).toContain(
      "We couldn't complete that request."
    );
  });
});
