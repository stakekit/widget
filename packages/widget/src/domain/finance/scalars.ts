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
      decode: SchemaGetter.transformOrFail((input) =>
        input === undefined
          ? Effect.succeed(undefined)
          : decodeOptionalUtcDateTime(input, options)
      ),
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
