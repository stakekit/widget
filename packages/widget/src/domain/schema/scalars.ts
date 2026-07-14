import BigNumber from "bignumber.js";
import { Schema, SchemaTransformation } from "effect";

export const BigIntFromString = Schema.BigIntFromString;
export type BigIntFromString = typeof BigIntFromString.Type;

export const PrecisionDecimalFromString = Schema.String.check(
  Schema.isStringFinite()
).pipe(
  Schema.decodeTo(
    Schema.instanceOf(BigNumber),
    SchemaTransformation.transform({
      decode: (value) => new BigNumber(value),
      encode: (value) => value.toFixed(),
    })
  )
);

export const ValidDateFromString = Schema.DateFromString.pipe(
  Schema.decodeTo(Schema.DateValid)
);
export type ValidDateFromString = typeof ValidDateFromString.Type;

export const UtcDateTimeFromString = Schema.DateTimeUtcFromString;
export type UtcDateTimeFromString = typeof UtcDateTimeFromString.Type;
