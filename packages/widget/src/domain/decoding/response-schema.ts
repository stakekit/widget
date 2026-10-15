import {
  Array as EArray,
  Effect,
  Option,
  Result,
  Schema,
  SchemaGetter,
} from "effect";
import {
  logDecodeFieldRejection,
  logDecodeRejection,
} from "./decode-diagnostics";

type CollectionResponseSchemaOptions = {
  readonly operation: string;
  readonly identifier?: Schema.ConstraintDecoder<PropertyKey>;
};

type ArrayResponseSchemaOptions = CollectionResponseSchemaOptions & {
  /**
   * Entries outside the widget's supported set are expected and skipped
   * without a rejection diagnostic. Supported entries that fail to decode are
   * still rejected and reported.
   */
  readonly isSupported?: (input: unknown) => boolean;
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
 * A response schema that rejects invalid array entries independently, at any
 * depth of a response. The complete item schema is applied once per entry, so
 * nested failures reject their parent entry instead of producing partially
 * decoded models.
 */
export const TolerantArray = <Item extends Schema.ConstraintDecoder<unknown>>(
  item: Item,
  options: ArrayResponseSchemaOptions
) =>
  Schema.Array(Schema.Unknown).pipe(
    Schema.decodeTo(Schema.Array(Schema.toType(item)), {
      decode: SchemaGetter.transformEffect((inputs) =>
        Effect.forEach(inputs, (input, index) => {
          if (options.isSupported && !options.isSupported(input)) {
            return Effect.succeedNone;
          }

          const result = Schema.decodeUnknownResult(item)(input);

          return Result.match(result, {
            onFailure: (failure) =>
              logDecodeRejection({
                operation: options.operation,
                location: index,
                identifier: decodeIdentifier(options.identifier, input),
                issue: failure.message,
              }).pipe(Effect.as(Option.none<Item["Type"]>())),
            onSuccess: Effect.succeedSome,
          });
        }).pipe(Effect.map(EArray.getSomes))
      ),
      encode: SchemaGetter.forbidden(
        () => "Cannot encode a tolerant array response"
      ),
    })
  );

/**
 * A response schema that rejects invalid key-value entries independently.
 * Both the key and the complete value must decode successfully.
 */
export const TolerantRecord = <
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
      decode: SchemaGetter.transformEffect((input) =>
        Effect.forEach(Object.entries(input), ([rawKey, rawValue]) => {
          const decodedKey = Schema.decodeResult(key)(rawKey);
          const decodedValue = Schema.decodeUnknownResult(value)(rawValue);

          if (Result.isSuccess(decodedKey) && Result.isSuccess(decodedValue)) {
            return Effect.succeedSome([
              decodedKey.success,
              decodedValue.success,
            ] as const);
          }

          const getIssue = () => {
            if (Result.isFailure(decodedKey)) {
              return `key: ${decodedKey.failure.message}`;
            }
            if (Result.isFailure(decodedValue)) {
              return `value: ${decodedValue.failure.message}`;
            }
            return "Unknown key-value decode failure";
          };
          const issue = getIssue();

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
        () => "Cannot encode a tolerant record response"
      ),
    })
  );
};

/**
 * A nullable response field that becomes `null` when its value fails to
 * decode, for optional sub-models whose absence the widget already handles.
 */
export const TolerantNullOr = <Value extends Schema.ConstraintDecoder<unknown>>(
  value: Value,
  options: { readonly operation: string; readonly field: string }
) =>
  Schema.Unknown.pipe(
    Schema.decodeTo(Schema.NullOr(Schema.toType(value)), {
      decode: SchemaGetter.transformEffect((input) => {
        if (input === null) return Effect.succeed(null);

        return Result.match(Schema.decodeResult(value)(input), {
          onFailure: (failure) =>
            logDecodeFieldRejection({
              operation: options.operation,
              field: options.field,
              issue: failure.message,
            }).pipe(Effect.as(null)),
          onSuccess: Effect.succeed,
        });
      }),
      encode: SchemaGetter.forbidden(
        () => "Cannot encode a tolerant nullable response field"
      ),
    })
  );
