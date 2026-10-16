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
 * declares: the status's tag, the response, and its JSON body as `cause`.
 */
type DeclaredStatusError = {
  readonly _tag: string;
  readonly cause: unknown;
  readonly response: HttpClientResponse.HttpClientResponse;
};

/** Every failure a generated API client raises. */
type ApiClientError = HttpClientError.HttpClientError | DeclaredStatusError;

const decodeBody = (body: unknown): RichError | null =>
  Schema.decodeUnknownOption(RichError)(body).pipe(Option.getOrNull);

const decodeJsonBody = (description: string | undefined): RichError | null =>
  Schema.decodeUnknownOption(Schema.fromJsonString(RichError))(
    description
  ).pipe(Option.getOrNull);

const fromHttpClientError = ({
  reason,
}: HttpClientError.HttpClientError): ApiFailure => {
  switch (reason._tag) {
    case "TransportError":
      return ApiFailure.cases.Unreachable.make({});
    case "EncodeError":
    case "InvalidUrlError":
      return ApiFailure.cases.InvalidRequest.make({});
    case "StatusCodeError":
      // Generated clients keep an undeclared status's JSON body as the
      // description.
      return ApiFailure.cases.ErrorStatus.make({
        body: decodeJsonBody(reason.description),
        status: reason.response.status,
      });
    case "DecodeError":
    case "EmptyBodyError":
      return ApiFailure.cases.UnreadableResponse.make({
        status: reason.response.status,
      });
  }
};

const toApiFailure = (error: ApiClientError): ApiFailure =>
  HttpClientError.isHttpClientError(error)
    ? fromHttpClientError(error)
    : ApiFailure.cases.ErrorStatus.make({
        body: decodeBody(error.cause),
        status: error.response.status,
      });

export const withApiRequestError = (operation: string) =>
  function mapApiRequestError<A, E extends ApiClientError, R>(
    effect: Effect.Effect<A, E, R>
  ) {
    return effect.pipe(
      Effect.mapError(
        (cause) =>
          new ApiRequestError({
            cause,
            failure: toApiFailure(cause),
            operation,
          })
      )
    );
  };

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
