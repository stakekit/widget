import { Schema } from "effect";

const RichErrorDetails = Schema.StructWithRest(
  Schema.Struct({
    reason: Schema.optionalKey(Schema.Trim),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)]
);

export const RichError = Schema.StructWithRest(
  Schema.Struct({
    message: Schema.Trim,
    details: Schema.optionalKey(RichErrorDetails),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)]
).check(
  Schema.makeFilter((error) =>
    error.type === "GEO_LOCATION"
      ? "geolocation errors are not presentable rich errors"
      : true
  )
);

export type RichError = typeof RichError.Type;
