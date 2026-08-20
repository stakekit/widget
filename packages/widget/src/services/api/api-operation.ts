import { Effect, Option, Schema } from "effect";
import { RichError } from "../errors/rich-error";
import type { RichErrorService } from "../errors/rich-error-service";
import {
  ApiRequestError,
  InputValidationError,
  ResponseDecodeError,
} from "./resource-sources";

const Request = Schema.Struct({ url: Schema.String });
const DirectApiFailure = Schema.Struct({
  cause: Schema.Unknown,
  request: Request,
});
const EncodedResponseFailure = Schema.Struct({
  reason: Schema.Struct({
    description: Schema.String,
    response: Schema.Struct({ request: Request }),
  }),
});
const EncodedRequestFailure = Schema.Struct({
  reason: Schema.Struct({
    description: Schema.String,
    request: Request,
  }),
});

const decodeDescription = (description: string): RichError | null =>
  Schema.decodeUnknownOption(Schema.fromJsonString(RichError))(
    description
  ).pipe(Option.getOrNull);

const richErrorFrom = (cause: unknown): RichError | null => {
  const direct = Schema.decodeUnknownOption(DirectApiFailure)(cause).pipe(
    Option.getOrNull
  );
  if (direct) {
    return direct.request.url.includes("gas-estimate")
      ? null
      : Schema.decodeUnknownOption(RichError)(direct.cause).pipe(
          Option.getOrNull
        );
  }

  const responseFailure = Schema.decodeUnknownOption(EncodedResponseFailure)(
    cause
  ).pipe(Option.getOrNull);
  if (responseFailure) {
    return responseFailure.reason.response.request.url.includes("gas-estimate")
      ? null
      : decodeDescription(responseFailure.reason.description);
  }

  const requestFailure = Schema.decodeUnknownOption(EncodedRequestFailure)(
    cause
  ).pipe(Option.getOrNull);
  if (!requestFailure) return null;

  return requestFailure.reason.request.url.includes("gas-estimate")
    ? null
    : decodeDescription(requestFailure.reason.description);
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

export const presentApiRequestError =
  (richErrors: RichErrorService["Service"]) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.tapError((error) =>
        Schema.is(ApiRequestError)(error)
          ? richErrors.present(error)
          : Effect.void
      )
    );

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
