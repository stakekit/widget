import { Option, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { RichError } from "../../src/services/errors/rich-error";

describe("RichError", () => {
  it("decodes a reason while preserving interpolation details", () => {
    expect(
      Schema.decodeUnknownSync(RichError)({
        message: "KaminoLendingInsufficientSolForRentError",
        details: {
          amount: "0.01 SOL",
          reason: "  Insufficient SOL for transaction.  ",
        },
      })
    ).toEqual({
      message: "KaminoLendingInsufficientSolForRentError",
      details: {
        amount: "0.01 SOL",
        reason: "  Insufficient SOL for transaction.  ",
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

  it.each([{ reason: "" }, { reason: "   " }])(
    "accepts any string reason",
    (details) => {
      expect(
        Schema.decodeUnknownSync(RichError)({
          message: "KaminoLendingInsufficientSolForRentError",
          details,
        })
      ).toEqual({
        message: "KaminoLendingInsufficientSolForRentError",
        details,
      });
    }
  );

  it("rejects geolocation errors", () => {
    expect(
      Schema.decodeUnknownOption(RichError)({
        message: "Access denied",
        type: "GEO_LOCATION",
      }).pipe(Option.isNone)
    ).toBe(true);
  });
});
