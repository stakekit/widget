import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { withApiRequestError } from "../../src/services/api/api-operation";
import {
  ApiRequestError,
  type InputValidationError,
  ResponseDecodeError,
} from "../../src/services/api/resource-sources";

type ApiBoundaryError =
  | ApiRequestError
  | InputValidationError
  | ResponseDecodeError;

const classify = (error: ApiBoundaryError) =>
  Effect.fail(error).pipe(
    Effect.catchTags({
      ApiRequestError: () => Effect.succeed("api" as const),
      ResponseDecodeError: () => Effect.succeed("decode" as const),
    })
  );

describe("API boundary errors", () => {
  it.effect("distinguishes API, decode, and absence failures by tag", () =>
    Effect.gen(function* () {
      const requestError = new ApiRequestError({
        operation: "yield-list",
        cause: new Error("network"),
      });
      expect(requestError.richError).toBeNull();

      expect(yield* classify(requestError)).toBe("api");
      expect(
        yield* classify(
          new ResponseDecodeError({
            operation: "yield-list",
            issue: "missing id",
            cause: new Error("schema"),
          })
        )
      ).toBe("decode");
    })
  );

  it.effect(
    "retains a validated rich error on normalized API request failures",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.fail({
          cause: {
            details: { code: "TEST" },
            message: "Rich failure",
          },
          request: { url: "https://api.example.com/v1/tokens" },
        }).pipe(withApiRequestError("token-options"), Effect.flip);

        expect(error.richError).toEqual({
          details: { code: "TEST" },
          message: "Rich failure",
        });
      })
  );

  it.effect.each([
    {
      cause: new Error("network unavailable"),
      label: "plain network error",
    },
    {
      cause: {
        cause: { details: "invalid", message: "Invalid details" },
        request: { url: "https://api.example.com/v1/tokens" },
      },
      label: "invalid payload",
    },
    {
      cause: {
        cause: { message: "Access denied", type: "GEO_LOCATION" },
        request: { url: "https://api.example.com/v1/tokens" },
      },
      label: "geo-block payload",
    },
    {
      cause: {
        reason: {
          description: JSON.stringify({
            message: "Access denied",
            type: "GEO_LOCATION",
          }),
          response: {
            request: { url: "https://api.example.com/v1/tokens" },
          },
        },
      },
      label: "JSON-encoded geo-block payload",
    },
    {
      cause: {
        cause: { message: "Gas estimate failed" },
        request: { url: "https://api.example.com/v1/gas-estimate" },
      },
      label: "gas-estimate response",
    },
  ])("does not retain rich error data for $label", ({ cause }) =>
    Effect.gen(function* () {
      const error = yield* Effect.fail(cause).pipe(
        withApiRequestError("excluded-operation"),
        Effect.flip
      );

      expect(error.richError).toBeNull();
    })
  );
});
