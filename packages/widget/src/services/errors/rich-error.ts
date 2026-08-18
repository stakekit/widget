import { Schema } from "effect";

export const RichError = Schema.Struct({
  message: Schema.String,
  details: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
});

export type RichError = typeof RichError.Type;
