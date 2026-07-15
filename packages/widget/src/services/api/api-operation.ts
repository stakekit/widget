import { Effect, Schema } from "effect";
import {
  ApiRequestError,
  InputValidationError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";

export const withApiRequestError = (operation: string) =>
  function mapApiRequestError<A, E, R>(effect: Effect.Effect<A, E, R>) {
    return effect.pipe(
      Effect.mapError(
        (cause) =>
          new ApiRequestError({
            operation,
            cause,
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
