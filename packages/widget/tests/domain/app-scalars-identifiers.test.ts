import { DateTime, Schema } from "effect";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  type ActionId,
  type ProviderId,
  TokenAddress,
  type TransactionId,
  type YieldId,
} from "../../src/domain/schema/identifiers";
import {
  BigIntFromString,
  PrecisionDecimalFromString,
  UtcDateTimeFromString,
  ValidDateFromString,
} from "../../src/domain/schema/scalars";

describe("application scalar and identifier schemas", () => {
  it("uses lossless representations for raw units and decimal values", () => {
    expect(
      Schema.decodeUnknownSync(BigIntFromString)(
        "900719925474099312345678901234567890"
      )
    ).toBe(900719925474099312345678901234567890n);
    expect(
      Schema.decodeUnknownSync(PrecisionDecimalFromString)(
        "9007199254740993.000000000000000001"
      ).toFixed()
    ).toBe("9007199254740993.000000000000000001");
  });

  it("rejects invalid dates and normalizes valid date-times to UTC", () => {
    const date = Schema.decodeUnknownSync(ValidDateFromString)(
      "2026-07-10T12:00:00Z"
    );
    const dateTime = Schema.decodeUnknownSync(UtcDateTimeFromString)(
      "2026-07-10T14:00:00+02:00"
    );

    expect(date.toISOString()).toBe("2026-07-10T12:00:00.000Z");
    expect(DateTime.formatIso(dateTime)).toBe("2026-07-10T12:00:00.000Z");
    expect(() =>
      Schema.decodeUnknownSync(ValidDateFromString)("not-a-date")
    ).toThrow();
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
