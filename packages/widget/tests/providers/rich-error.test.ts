import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { RichError } from "../../src/services/errors/rich-error";

describe("RichError", () => {
  it("trims the message and reason while preserving interpolation details", () => {
    expect(
      Schema.decodeSync(RichError)({
        message: "  KaminoLendingInsufficientSolForRentError  ",
        details: {
          amount: "0.01 SOL",
          reason: "  Insufficient SOL for transaction.  ",
        },
      })
    ).toEqual({
      message: "KaminoLendingInsufficientSolForRentError",
      details: {
        amount: "0.01 SOL",
        reason: "Insufficient SOL for transaction.",
      },
    });
  });

  it.each([{ reason: 42 }, { reason: null }])(
    "rejects a non-string reason",
    (details) => {
      expect(
        Schema.decodeUnknownOption(RichError)({
          message: "KaminoLendingInsufficientSolForRentError",
          details,
        }).pipe(Option.isNone)
      ).toBe(true);
    }
  );

  it.each(["", "   "])(
    "decodes a blank reason as an empty string",
    (reason) => {
      expect(
        Schema.decodeSync(RichError)({
          message: "KaminoLendingInsufficientSolForRentError",
          details: { reason },
        })
      ).toEqual({
        message: "KaminoLendingInsufficientSolForRentError",
        details: { reason: "" },
      });
    }
  );

  it("rejects geolocation errors", () => {
    expect(
      Schema.decodeOption(RichError)({
        message: "Access denied",
        type: "GEO_LOCATION",
      }).pipe(Option.isNone)
    ).toBe(true);
  });
});
