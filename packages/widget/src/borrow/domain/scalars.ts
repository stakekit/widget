import { Schema } from "effect";
import { bigintFromString } from "effect/SchemaTransformation";

export const NumberFromString = Schema.NumberFromString;
export type NumberFromString = typeof NumberFromString.Type;

export const BigIntFromString = Schema.String.pipe(
  Schema.decodeTo(Schema.BigInt, bigintFromString)
);
export type BigIntFromString = typeof BigIntFromString.Type;
