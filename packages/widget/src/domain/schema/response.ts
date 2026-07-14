import {
  Array as EArray,
  Effect,
  Option,
  Result,
  Schema,
  SchemaGetter,
} from "effect";
import { logDecodeRejection } from "./decode-diagnostics";

type CollectionResponseSchemaOptions = {
  readonly operation: string;
  readonly identifier?: Schema.ConstraintDecoder<PropertyKey>;
};

const decodeIdentifier = (
  schema: Schema.ConstraintDecoder<PropertyKey> | undefined,
  input: unknown
) => {
  if (!schema) return undefined;

  const result = Schema.decodeUnknownResult(schema)(input);
  return Result.isSuccess(result) ? String(result.success) : undefined;
};

/**
 * A response schema that rejects invalid top-level array entries independently.
 * The complete item schema is applied once per entry, so nested failures reject
 * their parent entry instead of producing partially decoded models.
 */
export const TolerantTopLevelArray = <
  Item extends Schema.ConstraintDecoder<unknown>,
>(
  item: Item,
  options: CollectionResponseSchemaOptions
) =>
  Schema.Array(Schema.Unknown).pipe(
    Schema.decodeTo(Schema.Array(Schema.toType(item)), {
      decode: SchemaGetter.transformOrFail((inputs) =>
        Effect.forEach(inputs, (input, index) => {
          const result = Schema.decodeUnknownResult(item)(input);

          return Result.match(result, {
            onFailure: (failure) =>
              logDecodeRejection({
                operation: options.operation,
                location: index,
                identifier: decodeIdentifier(options.identifier, input),
                issue: failure.message,
              }).pipe(Effect.as(Option.none<Item["Type"]>())),
            onSuccess: (value) => Effect.succeed(Option.some(value)),
          });
        }).pipe(Effect.map(EArray.getSomes))
      ),
      encode: SchemaGetter.forbidden(
        () => "Cannot encode a tolerant top-level array response"
      ),
    })
  );

/**
 * A response schema that rejects invalid top-level key-value entries
 * independently. Both the key and the complete value must decode successfully.
 */
export const TolerantTopLevelRecord = <
  Key extends Schema.Record.Key & Schema.ConstraintDecoder<PropertyKey>,
  Value extends Schema.ConstraintDecoder<unknown>,
>(
  key: Key,
  value: Value,
  options: CollectionResponseSchemaOptions
) => {
  const target = Schema.Record(Schema.toType(key), Schema.toType(value));

  return Schema.Record(Schema.String, Schema.Unknown).pipe(
    Schema.decodeTo(target, {
      decode: SchemaGetter.transformOrFail((input) =>
        Effect.forEach(Object.entries(input), ([rawKey, rawValue]) => {
          const decodedKey = Schema.decodeUnknownResult(key)(rawKey);
          const decodedValue = Schema.decodeUnknownResult(value)(rawValue);

          if (Result.isSuccess(decodedKey) && Result.isSuccess(decodedValue)) {
            return Effect.succeed(
              Option.some([decodedKey.success, decodedValue.success] as const)
            );
          }

          const issue = Result.isFailure(decodedKey)
            ? `key: ${decodedKey.failure.message}`
            : Result.isFailure(decodedValue)
              ? `value: ${decodedValue.failure.message}`
              : "Unknown key-value decode failure";

          return logDecodeRejection({
            operation: options.operation,
            location: rawKey,
            identifier:
              decodeIdentifier(options.identifier, rawValue) ?? rawKey,
            issue,
          }).pipe(
            Effect.as(Option.none<readonly [Key["Type"], Value["Type"]]>())
          );
        }).pipe(Effect.map(EArray.getSomes), Effect.map(Object.fromEntries))
      ),
      encode: SchemaGetter.forbidden(
        () => "Cannot encode a tolerant top-level record response"
      ),
    })
  );
};
