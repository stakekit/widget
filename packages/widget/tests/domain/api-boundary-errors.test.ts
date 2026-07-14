import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  ApiRequestError,
  type InputValidationError,
  ResponseDecodeError,
} from "../../src/domain/schema/api-errors";

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
  it("distinguishes API, decode, and absence failures by tag", async () => {
    await expect(
      Effect.runPromise(
        classify(
          new ApiRequestError({
            operation: "yield-list",
            cause: new Error("network"),
          })
        )
      )
    ).resolves.toBe("api");
    await expect(
      Effect.runPromise(
        classify(
          new ResponseDecodeError({
            operation: "yield-list",
            issue: "missing id",
            cause: new Error("schema"),
          })
        )
      )
    ).resolves.toBe("decode");
  });
});
