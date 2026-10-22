import { Effect, Option, Schema } from "effect";
import * as HttpClientError from "effect/http/HttpClientError";
import type * as HttpClientResponse from "effect/http/HttpClientResponse";
import type { BorrowFeatureDisabled } from "../../domain/borrow/availability";
import { RichError } from "../errors/rich-error";
import type { RichErrorService } from "../errors/rich-error-service";
import {
  ApiFailure,
  ApiRequestError,
  InputValidationError,
  type MissingBorrowApiConfig,
  ResponseDecodeError,
} from "./resource-sources";

/**
 * The failure a generated client raises for a status its OpenAPI operation
 * declares, with or without a body schema.
 */
type DeclaredStatusError = {
  readonly _tag: string;
  readonly response: HttpClientResponse.HttpClientResponse;
};

/** Every failure a generated API client raises. */
type ApiClientError = HttpClientError.HttpClientError | DeclaredStatusError;

/**
 * An error status with the API's rich error read from the response body.
 * Generated clients read bodies through the cached response, so reading it
 * again is safe; a body that is not a rich error is null.
 */
const readErrorStatus = (response: HttpClientResponse.HttpClientResponse) =>
  response.json.pipe(
    Effect.map((body) =>
      Schema.decodeUnknownOption(RichError)(body).pipe(Option.getOrNull)
    ),
    Effect.orElseSucceed(() => null),
    Effect.map((body) =>
      ApiFailure.cases.ErrorStatus.make({ body, status: response.status })
    )
  );

/**
 * Classifies a client failure by what the API answered, not by how the spec
 * declares the status: undeclared, declared without a body, and declared with
 * a body all become the same error status.
 */
const toApiFailure = (error: ApiClientError): Effect.Effect<ApiFailure> => {
  if (!HttpClientError.isHttpClientError(error)) {
    return readErrorStatus(error.response);
  }
  const { reason } = error;
  switch (reason._tag) {
    case "TransportError":
      return Effect.succeed(ApiFailure.cases.Unreachable.make({}));
    case "EncodeError":
    case "InvalidUrlError":
      return Effect.succeed(ApiFailure.cases.InvalidRequest.make({}));
    case "StatusCodeError":
      return readErrorStatus(reason.response);
    case "DecodeError":
    case "EmptyBodyError":
      // A declared error body the client could not decode is still an error.
      return reason.response.status >= 400
        ? readErrorStatus(reason.response)
        : Effect.succeed(
            ApiFailure.cases.UnreadableResponse.make({
              status: reason.response.status,
            })
          );
  }
};

export const withApiRequestError = (operation: string) =>
  function mapApiRequestError<A, E extends ApiClientError, R>(
    effect: Effect.Effect<A, E, R>
  ) {
    return effect.pipe(
      Effect.catch((cause) =>
        toApiFailure(cause).pipe(
          Effect.flatMap((failure) =>
            Effect.fail(new ApiRequestError({ cause, failure, operation }))
          )
        )
      )
    );
  };

/**
 * A 404 means absence, whether the spec declares it or not; any other
 * failure stays a failure.
 */
export const recoverNotFound =
  <A>(absent: A) =>
  <E extends ApiClientError>(error: E) =>
    toApiFailure(error).pipe(
      Effect.flatMap((failure) =>
        failure._tag === "ErrorStatus" && failure.status === 404
          ? Effect.succeed(absent)
          : Effect.fail(error)
      )
    );

type ApiOperationError =
  | ApiRequestError
  | BorrowFeatureDisabled
  | InputValidationError
  | MissingBorrowApiConfig
  | ResponseDecodeError;

export const presentApiRequestError =
  (richErrors: RichErrorService["Service"]) =>
  <A, E extends ApiOperationError, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.tapError((error) =>
        error._tag === "ApiRequestError"
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
  function decodeResponse<E extends ApiClientError, R>(
    effect: Effect.Effect<unknown, E, R>
  ) {
    return effect.pipe(
      withApiRequestError(operation),
      Effect.flatMap((response) =>
        Schema.decodeUnknownEffect(schema)(response).pipe(
          withResponseDecodeError(operation)
        )
      )
    );
  };
