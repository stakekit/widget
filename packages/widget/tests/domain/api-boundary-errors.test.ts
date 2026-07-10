import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  type ApiBoundaryError,
  ApiRequestError,
  ApiResourceNotFound,
  ResponseDecodeError,
} from "../../src/domain/schema/api-errors";

const classify = (error: ApiBoundaryError) =>
  Effect.fail(error).pipe(
    Effect.catchTags({
      ApiRequestError: () => Effect.succeed("api" as const),
      ApiResourceNotFound: () => Effect.succeed("not-found" as const),
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
    await expect(
      Effect.runPromise(
        classify(
          new ApiResourceNotFound({
            operation: "yield-detail",
            identifier: "yield-id",
          })
        )
      )
    ).resolves.toBe("not-found");
  });
});
