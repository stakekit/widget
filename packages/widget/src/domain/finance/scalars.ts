import BigNumber from "bignumber.js";
import {
  DateTime,
  Effect,
  Result,
  Schema,
  SchemaGetter,
  SchemaTransformation,
} from "effect";
import { logDecodeFieldRejection } from "../decoding/decode-diagnostics";
import "./config";

export const ExactDecimalInput = Schema.Union([
  Schema.String.check(Schema.isStringFinite()),
  Schema.Finite,
]);

export const ExactDecimal = ExactDecimalInput.pipe(
  Schema.decodeTo(
    Schema.instanceOf(BigNumber).check(
      Schema.makeFilter((value) =>
        value.isFinite() ? true : "expected a finite decimal"
      )
    ),
    SchemaTransformation.transform({
      decode: (value) => new BigNumber(value),
      encode: (value) => value.toFixed(),
    })
  )
);
export type ExactDecimal = typeof ExactDecimal.Type;

const nonNegativeExactDecimalFilter = Schema.makeFilter((value: BigNumber) =>
  value.isGreaterThanOrEqualTo(0)
    ? true
    : "expected a finite non-negative decimal"
);

export const NonNegativeExactDecimal = ExactDecimal.check(
  nonNegativeExactDecimalFilter
);
export type NonNegativeExactDecimal = typeof NonNegativeExactDecimal.Type;

const SafeIntegerBaseUnitAmount = Schema.Finite.check(
  Schema.makeFilter((value) =>
    Number.isSafeInteger(value)
      ? true
      : "expected a safe integer Base Unit Amount"
  )
).pipe(
  Schema.decodeTo(
    Schema.BigInt,
    SchemaTransformation.transform({
      decode: (value) => BigInt(value),
      encode: (value) => Number(value),
    })
  )
);

export const ExactBaseUnitAmount = Schema.Union([
  Schema.BigIntFromString,
  SafeIntegerBaseUnitAmount,
]);
export type ExactBaseUnitAmount = typeof ExactBaseUnitAmount.Type;

export const UtcDateTimeFromString = Schema.DateTimeUtcFromString;
export type UtcDateTimeFromString = typeof UtcDateTimeFromString.Type;

type TolerantDateTimeOptions = {
  readonly operation: string;
  readonly field: string;
};

const decodeOptionalUtcDateTime = (
  input: unknown,
  options: TolerantDateTimeOptions
): Effect.Effect<DateTime.Utc | undefined> => {
  const decoded = Schema.decodeUnknownResult(UtcDateTimeFromString)(input);

  return Result.match(decoded, {
    onFailure: () =>
      logDecodeFieldRejection({
        ...options,
        issue: "invalid UTC date-time",
      }).pipe(Effect.as(undefined)),
    onSuccess: (value) => Effect.succeed(value),
  });
};

export const TolerantOptionalUtcDateTimeFromString = (
  options: TolerantDateTimeOptions
) =>
  Schema.Unknown.pipe(
    Schema.decodeTo(Schema.UndefinedOr(Schema.DateTimeUtc), {
      decode: SchemaGetter.transformOrFail((input) => {
        if (input === undefined) {
          // Effect.void widens the success type to void, which is incompatible
          // with the schema's precise DateTime.Utc | undefined output.
          // @effect-diagnostics-next-line effectSucceedWithVoid:off
          return Effect.succeed(undefined);
        }
        return decodeOptionalUtcDateTime(input, options);
      }),
      encode: SchemaGetter.transform((value) =>
        value === undefined ? undefined : DateTime.formatIso(value)
      ),
    })
  );

export const TolerantNullableUtcDateTimeFromString = (
  options: TolerantDateTimeOptions
) =>
  Schema.Unknown.pipe(
    Schema.decodeTo(Schema.NullOr(Schema.DateTimeUtc), {
      decode: SchemaGetter.transformOrFail((input) =>
        input === null
          ? Effect.succeed(null)
          : decodeOptionalUtcDateTime(input, options).pipe(
              Effect.map((value) => value ?? null)
            )
      ),
      encode: SchemaGetter.transform((value) =>
        value === null ? null : DateTime.formatIso(value)
      ),
    })
  );
