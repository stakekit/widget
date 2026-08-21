import { describe, expect, it } from "vitest";
import { unknownErrorDetail } from "../../src/features/widget-shell/model/unknown-error-detail";

describe("unknownErrorDetail", () => {
  it("prefers a trimmed reason over the message", () => {
    expect(
      unknownErrorDetail({
        message: "KaminoLendingInsufficientSolForRentError",
        details: { reason: "  Not enough SOL for rent.  " },
      })
    ).toBe("Not enough SOL for rent.");
  });

  it.each([
    "KaminoLendingInsufficientSolForRentError",
    "MinimumAmountNotReachedError",
  ])("hides the identity-shaped message %s", (message) => {
    expect(unknownErrorDetail({ message })).toBeUndefined();
  });

  it.each([
    "KYC required",
    "ethereum-usdc-vault is currently closed for new deposits",
  ])("shows the server prose message %s", (message) => {
    expect(unknownErrorDetail({ message })).toBe(message);
  });

  it.each([{ reason: "" }, { reason: "   " }])(
    "falls back to the message when the reason is blank",
    (details) => {
      expect(unknownErrorDetail({ message: "KYC required", details })).toBe(
        "KYC required"
      );
    }
  );

  it("returns nothing when neither a reason nor prose is available", () => {
    expect(
      unknownErrorDetail({ message: "   ", details: { reason: "  " } })
    ).toBeUndefined();
  });
});
