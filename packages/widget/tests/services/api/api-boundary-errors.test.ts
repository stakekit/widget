import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import { BorrowApiError } from "../../../src/generated/api/borrow-client";
import { withApiRequestError } from "../../../src/services/api/api-operation";
import {
  getApiRejectionReason,
  isTransientApiFailure,
} from "../../../src/services/api/operations";
import {
  type ApiFailure,
  ApiRequestError,
  ResponseDecodeError,
} from "../../../src/services/api/resource-sources";

const request = HttpClientRequest.post("https://borrow.test/v1/actions");
const response = (status: number, body?: unknown) =>
  HttpClientResponse.fromWeb(
    request,
    new Response(body === undefined ? null : JSON.stringify(body), { status })
  );
// Generated clients keep an undeclared status's JSON body as the description.
const statusError = (status: number, body?: unknown) =>
  new HttpClientError.HttpClientError({
    reason: new HttpClientError.StatusCodeError({
      description: body === undefined ? undefined : JSON.stringify(body),
      request,
      response: response(status, body),
    }),
  });

const kycRequired = { message: "KYC required", statusCode: 412 };

const normalize = (
  error: HttpClientError.HttpClientError | BorrowApiError<string, unknown>
) =>
  Effect.fail(error).pipe(
    withApiRequestError("borrow-action-create"),
    Effect.flip
  );

const requestError = (failure: ApiFailure) =>
  new ApiRequestError({ cause: undefined, failure, operation: "test" });

describe("API request failures", () => {
  it.effect.each<{
    readonly case: string;
    readonly error:
      | HttpClientError.HttpClientError
      | BorrowApiError<string, unknown>;
    readonly failure: ApiFailure;
  }>([
    {
      case: "a transport failure is unreachable",
      error: new HttpClientError.HttpClientError({
        reason: new HttpClientError.TransportError({ request }),
      }),
      failure: { _tag: "Unreachable" },
    },
    {
      case: "an unbuildable URL is an invalid request",
      error: new HttpClientError.HttpClientError({
        reason: new HttpClientError.InvalidUrlError({ request }),
      }),
      failure: { _tag: "InvalidRequest" },
    },
    // However the spec declares a status, the body comes from the response.
    {
      case: "an undeclared status keeps its JSON body",
      error: statusError(412, kycRequired),
      failure: { _tag: "ErrorStatus", body: kycRequired, status: 412 },
    },
    {
      case: "a status declared with a body keeps its JSON body",
      error: BorrowApiError(
        "ActionsControllerExecuteActionV1412",
        kycRequired,
        response(412, kycRequired)
      ),
      failure: { _tag: "ErrorStatus", body: kycRequired, status: 412 },
    },
    {
      case: "a status declared without a body keeps its JSON body",
      error: BorrowApiError("412", undefined, response(412, kycRequired)),
      failure: { _tag: "ErrorStatus", body: kycRequired, status: 412 },
    },
    {
      case: "a status without a body",
      error: statusError(500),
      failure: { _tag: "ErrorStatus", body: null, status: 500 },
    },
    {
      case: "a non-JSON body is not presentable",
      error: BorrowApiError(
        "502",
        undefined,
        HttpClientResponse.fromWeb(
          request,
          new Response("<html>Bad Gateway</html>", { status: 502 })
        )
      ),
      failure: { _tag: "ErrorStatus", body: null, status: 502 },
    },
    {
      case: "a declared error body the client cannot decode is still an error status",
      error: new HttpClientError.HttpClientError({
        reason: new HttpClientError.DecodeError({
          request,
          response: HttpClientResponse.fromWeb(
            request,
            new Response("<html>Too Many Requests</html>", { status: 429 })
          ),
        }),
      }),
      failure: { _tag: "ErrorStatus", body: null, status: 429 },
    },
    {
      case: "a geo-block body is not presentable",
      error: statusError(403, {
        message: "Access denied",
        type: "GEO_LOCATION",
      }),
      failure: { _tag: "ErrorStatus", body: null, status: 403 },
    },
    {
      case: "an undecodable success body is unreadable",
      error: new HttpClientError.HttpClientError({
        reason: new HttpClientError.DecodeError({
          request,
          response: response(200),
        }),
      }),
      failure: { _tag: "UnreadableResponse", status: 200 },
    },
  ])("$case", ({ error, failure }) =>
    Effect.gen(function* () {
      expect((yield* normalize(error)).failure).toEqual(failure);
    })
  );

  it.each<{
    readonly case: string;
    readonly failure: ApiFailure;
    readonly presented: { readonly message: string } | null;
  }>([
    {
      case: "an error status presents the API's body",
      failure: {
        _tag: "ErrorStatus",
        body: { message: "InvalidAddressError" },
        status: 400,
      },
      presented: { message: "InvalidAddressError" },
    },
    {
      case: "no answer presents the widget's own identity",
      failure: { _tag: "Unreachable" },
      presented: { message: "ApiUnreachableError" },
    },
    {
      case: "an error status without a body is not presented",
      failure: { _tag: "ErrorStatus", body: null, status: 500 },
      presented: null,
    },
    {
      case: "an invalid request is not presented",
      failure: { _tag: "InvalidRequest" },
      presented: null,
    },
    {
      case: "an unreadable response is not presented",
      failure: { _tag: "UnreadableResponse", status: 200 },
      presented: null,
    },
  ])("$case", ({ failure, presented }) => {
    expect(requestError(failure).richError).toEqual(presented);
  });

  it.each<{
    readonly case: string;
    readonly failure: ApiFailure;
    readonly reason: Option.Option<string>;
  }>([
    {
      case: "a 4xx with a body",
      failure: {
        _tag: "ErrorStatus",
        body: { message: "Insufficient WETH balance." },
        status: 412,
      },
      reason: Option.some("Insufficient WETH balance."),
    },
    {
      case: "a 5xx with a body",
      failure: {
        _tag: "ErrorStatus",
        body: { message: "Internal server error" },
        status: 500,
      },
      reason: Option.none(),
    },
    {
      case: "a 4xx without a body",
      failure: { _tag: "ErrorStatus", body: null, status: 404 },
      reason: Option.none(),
    },
    {
      case: "no response",
      failure: { _tag: "Unreachable" },
      reason: Option.none(),
    },
  ])("reads the API's refusal reason from $case", ({ failure, reason }) => {
    expect(getApiRejectionReason(failure)).toEqual(reason);
  });

  it.each<{
    readonly case: string;
    readonly error: ApiRequestError | ResponseDecodeError;
    readonly transient: boolean;
  }>([
    {
      case: "an unreachable API",
      error: requestError({ _tag: "Unreachable" }),
      transient: true,
    },
    {
      case: "a 503",
      error: requestError({ _tag: "ErrorStatus", body: null, status: 503 }),
      transient: true,
    },
    {
      case: "a 400",
      error: requestError({ _tag: "ErrorStatus", body: null, status: 400 }),
      transient: false,
    },
    {
      case: "an unreadable response",
      error: requestError({ _tag: "UnreadableResponse", status: 200 }),
      transient: false,
    },
    {
      case: "an undecodable response",
      error: new ResponseDecodeError({
        cause: undefined,
        issue: "missing id",
        operation: "test",
      }),
      transient: false,
    },
  ])("retries $case: $transient", ({ error, transient }) => {
    expect(isTransientApiFailure(error)).toBe(transient);
  });
});
