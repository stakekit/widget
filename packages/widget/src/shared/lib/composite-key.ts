import { Schema } from "effect";

/** A plain JSON value, the only thing a composite key is built from. */
type CompositeKeyPart =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<CompositeKeyPart>
  | { readonly [key: string]: CompositeKeyPart | undefined };

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));

/**
 * One string identity for an ordered list of JSON parts. The same parts in the
 * same order (object keys too) give the same key, and part boundaries survive:
 * `["a,b", "c"]` and `["a", "b,c"]` differ. Numbers must be finite, since JSON
 * writes `NaN` and `Infinity` as `null`.
 */
export const compositeKey = (parts: ReadonlyArray<CompositeKeyPart>): string =>
  encodeJson(parts);
