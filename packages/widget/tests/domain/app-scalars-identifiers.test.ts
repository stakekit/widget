import { DateTime, Schema } from "effect";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  ExactBaseUnitAmount,
  ExactDecimal,
  UtcDateTimeFromString,
} from "../../src/domain/finance/scalars";
import {
  type ActionId,
  type ProviderId,
  TokenAddress,
  type TransactionId,
  type YieldId,
} from "../../src/domain/identity/identifiers";

describe("application scalar and identifier schemas", () => {
  it("uses lossless representations for raw units and decimal values", () => {
    expect(
      Schema.decodeUnknownSync(ExactBaseUnitAmount)(
        "900719925474099312345678901234567890"
      )
    ).toBe(900719925474099312345678901234567890n);
    expect(
      Schema.decodeUnknownSync(ExactDecimal)(
        "9007199254740993.000000000000000001"
      ).toFixed()
    ).toBe("9007199254740993.000000000000000001");
  });

  it("rejects invalid dates and normalizes valid date-times to UTC", () => {
    const dateTime = Schema.decodeUnknownSync(UtcDateTimeFromString)(
      "2026-07-10T14:00:00+02:00"
    );

    expect(DateTime.formatIso(dateTime)).toBe("2026-07-10T12:00:00.000Z");
    expect(() =>
      Schema.decodeUnknownSync(UtcDateTimeFromString)("not-a-date")
    ).toThrow();
  });

  it("keeps token addresses opaque", () => {
    expect(Schema.decodeUnknownSync(TokenAddress)("CaseSensitiveAddress")).toBe(
      "CaseSensitiveAddress"
    );
  });

  it("keeps identifier roles distinct at compile time", () => {
    expectTypeOf<YieldId>().not.toEqualTypeOf<ProviderId>();
    expectTypeOf<ActionId>().not.toEqualTypeOf<TransactionId>();
  });
});
