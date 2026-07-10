import BigNumber from "bignumber.js";
import { Schema, SchemaTransformation } from "effect";

export const FiniteNumberFromString = Schema.NumberFromString.check(
  Schema.isFinite()
);
export type FiniteNumberFromString = typeof FiniteNumberFromString.Type;

export const SafeIntegerFromString = Schema.NumberFromString.check(
  Schema.isInt()
);
export type SafeIntegerFromString = typeof SafeIntegerFromString.Type;

export const BigIntFromString = Schema.BigIntFromString;
export type BigIntFromString = typeof BigIntFromString.Type;

const DecimalString = Schema.String.check(
  Schema.isPattern(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/)
);

export const PrecisionDecimalFromString = DecimalString.pipe(
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
