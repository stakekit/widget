import { Result, Schema } from "effect";

/** Decodes a wallet payload, reducing a schema failure to its message. */
export const decodeWalletPayload = <
  S extends Schema.ConstraintDecoder<unknown>,
>(
  schema: S,
  input: unknown
): Result.Result<S["Type"], string> =>
  Schema.decodeUnknownResult(schema)(input).pipe(
    Result.mapError((error) => error.message)
  );
