import { Context, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import {
  MissingBorrowApiConfig,
  makeStakeKitApiLayer,
  StakeKitApiService,
} from "../../src/providers/api/api-client";

const config = {
  apiKey: "test-key",
  baseUrl: "https://api.example.com",
  borrowApiUrl: "https://borrow.example.com",
  yieldsApiUrl: "https://yield.example.com",
};

describe("StakeKit API service", () => {
  it("constructs typed generated clients through an Effect layer", async () => {
    const context = await Effect.runPromise(
      Layer.build(makeStakeKitApiLayer(config)).pipe(Effect.scoped)
    );
    const api = Context.get(context, StakeKitApiService);

    expect(api.borrow.MarketsControllerGetMarketsV1).toBeTypeOf("function");
    expect(api.legacy.TokenControllerGetTokens).toBeTypeOf("function");
    expect(api.yield.YieldsControllerGetYields).toBeTypeOf("function");
  });

  it("fails the layer when Borrow API configuration is missing", async () => {
    await expect(
      Effect.runPromise(
        Layer.build(
          makeStakeKitApiLayer({ ...config, borrowApiUrl: " " })
        ).pipe(Effect.scoped)
      )
    ).rejects.toBeInstanceOf(MissingBorrowApiConfig);
  });
});
