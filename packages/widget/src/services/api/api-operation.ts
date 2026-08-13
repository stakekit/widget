import { Effect, Option, Schema } from "effect";
import {
  ApiRequestError,
  InputValidationError,
  ResponseDecodeError,
  RichError,
} from "./api-errors";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const requestUrlFrom = (value: unknown): string | null => {
  if (!isRecord(value)) return null;

  if (isRecord(value.request) && typeof value.request.url === "string") {
    return value.request.url;
  }

  if (isRecord(value.response)) {
    const responseUrl = requestUrlFrom(value.response);
    if (responseUrl) return responseUrl;
  }

  return isRecord(value.reason) ? requestUrlFrom(value.reason) : null;
};

const decodeRichError = (value: unknown): RichError | null => {
  if (isRecord(value) && value.type === "GEO_LOCATION") return null;

  return Schema.decodeUnknownOption(RichError)(value).pipe(Option.getOrNull);
};

const richErrorFrom = (cause: unknown): RichError | null => {
  const url = requestUrlFrom(cause);
  if (url?.includes("gas-estimate")) return null;

  if (!isRecord(cause)) return null;

  const decodedCause = decodeRichError(cause.cause);
  if (decodedCause) return decodedCause;

  const description =
    isRecord(cause.reason) && typeof cause.reason.description === "string"
      ? cause.reason.description
      : null;

  if (!description) return null;

  const parsed = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(
    description
  ).pipe(Option.getOrNull);

  return decodeRichError(parsed);
};

export const withApiRequestError = (operation: string) =>
  function mapApiRequestError<A, E, R>(effect: Effect.Effect<A, E, R>) {
    return effect.pipe(
      Effect.mapError(
        (cause) =>
          new ApiRequestError({
            operation,
            cause,
            richError: richErrorFrom(cause),
          })
      )
    );
  };

export const withResponseDecodeError = (operation: string) =>
  function mapResponseDecodeError<A, R>(
    effect: Effect.Effect<A, Schema.SchemaError, R>
  ) {
    return effect.pipe(
      Effect.mapError(
        (cause) =>
          new ResponseDecodeError({
            operation,
            issue: cause.message,
            cause,
          })
      )
    );
  };

export const encodeApiRequest = <
  RequestSchema extends Schema.ConstraintEncoder<unknown>,
>(
  operation: string,
  schema: RequestSchema
) =>
  function encodeRequest(request: RequestSchema["Type"]) {
    return Schema.encodeEffect(schema)(request).pipe(
      Effect.mapError(
        (cause) =>
          new InputValidationError({
            operation,
            issue: cause.message,
            cause,
          })
      )
    );
  };

export const decodeApiResponse = <
  ResponseSchema extends Schema.ConstraintDecoder<unknown>,
>(
  operation: string,
  schema: ResponseSchema
) =>
  function decodeResponse<E, R>(effect: Effect.Effect<unknown, E, R>) {
    return effect.pipe(
      withApiRequestError(operation),
      Effect.flatMap((response) =>
        Schema.decodeUnknownEffect(schema)(response).pipe(
          withResponseDecodeError(operation)
        )
      )
    );
  };
