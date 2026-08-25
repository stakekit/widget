import { describe, expect, it } from "vitest";
import { richErrorDetail } from "../../src/features/widget-shell/model/rich-error-detail";

describe("richErrorDetail", () => {
  it("replaces Error Copy details with the English API reason", () => {
    expect(
      richErrorDetail({
        error: {
          message: "KaminoLendingInsufficientSolForRentError",
          details: {
            reason:
              "Insufficient SOL for transaction. Required: ~0.005 SOL, Current: 0.004 SOL",
          },
        },
        language: "en",
        errorCopyDetails:
          "There is not enough SOL to fund the account rent required by Kamino Lending",
      })
    ).toBe(
      "Insufficient SOL for transaction. Required: ~0.005 SOL, Current: 0.004 SOL"
    );
  });

  it("keeps Error Copy details when the language is not English", () => {
    expect(
      richErrorDetail({
        error: {
          message: "KaminoLendingInsufficientSolForRentError",
          details: { reason: "Insufficient SOL for transaction." },
        },
        language: "fr",
        errorCopyDetails:
          "Le solde SOL est insuffisant pour financer le loyer de compte",
      })
    ).toBe("Le solde SOL est insuffisant pour financer le loyer de compte");
  });

  it("hides a French unknown identity that carries only an English reason", () => {
    expect(
      richErrorDetail({
        error: {
          message: "FutureApiError",
          details: { reason: "The operation is temporarily unavailable." },
        },
        language: "fr",
      })
    ).toBeUndefined();
  });

  it("shows the English reason for an unknown identity", () => {
    expect(
      richErrorDetail({
        error: {
          message: "FutureApiError",
          details: { reason: "The operation is temporarily unavailable." },
        },
        language: "en",
      })
    ).toBe("The operation is temporarily unavailable.");
  });

  it.each(["en", "fr"])(
    "shows server prose in %s when no reason is available",
    (language) => {
      expect(
        richErrorDetail({ error: { message: "KYC required" }, language })
      ).toBe("KYC required");
    }
  );

  it("keeps English Error Copy details when the reason is blank", () => {
    expect(
      richErrorDetail({
        error: {
          message: "KaminoLendingInsufficientSolForRentError",
          details: { reason: "" },
        },
        language: "en",
        errorCopyDetails: "There is not enough SOL to fund the account rent",
      })
    ).toBe("There is not enough SOL to fund the account rent");
  });

  it("falls back to server prose when the English reason is blank", () => {
    expect(
      richErrorDetail({
        error: { message: "KYC required", details: { reason: "" } },
        language: "en",
      })
    ).toBe("KYC required");
  });

  it("returns nothing when neither a reason nor prose is available", () => {
    expect(
      richErrorDetail({
        error: { message: "", details: { reason: "" } },
        language: "en",
      })
    ).toBeUndefined();
  });

  it.each(["en", "fr"])(
    "hides an identity-shaped message in %s",
    (language) => {
      expect(
        richErrorDetail({
          error: { message: "MinimumAmountNotReachedError" },
          language,
        })
      ).toBeUndefined();
    }
  );
});
