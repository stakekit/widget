import { Context, Effect, Layer } from "effect";
import { HttpResponse, http } from "msw";
import { delayAPIRequests } from "../../src/common/delay-api-requests";
import { config } from "../../src/config";
import { useGeoBlock } from "../../src/hooks/use-geo-block";
import { useRichErrors } from "../../src/hooks/use-rich-errors";
import {
  MissingBorrowApiConfig,
  makeStakeKitApiLayer,
  StakeKitApiService,
} from "../../src/providers/api/api-client";
import { describe, expect, it } from "../utils/test-extend";
import { renderHook } from "../utils/test-utils";

const createTestClient = async (
  options: Partial<Parameters<typeof makeStakeKitApiLayer>[0]> = {}
) => {
  const context = await Effect.runPromise(
    Layer.build(
      makeStakeKitApiLayer({
        apiKey: "test-key",
        baseUrl: "https://api.example.com",
        borrowApiUrl: "https://borrow.example.com",
        yieldsApiUrl: "https://yield.example.com",
        ...options,
      })
    ).pipe(Effect.scoped)
  );

  return Context.get(context, StakeKitApiService);
};

const normalizeUrl = (url: string) => url.replace(/\/$/, "");

describe("Effect API client", () => {
  it("constructs all typed clients with shared headers", async ({ worker }) => {
    const calls: Array<{ headers: Headers; url: string }> = [];
    worker.use(
      http.get("https://api.example.com/v1/tokens", ({ request }) => {
        calls.push({ headers: request.headers, url: request.url });
        return HttpResponse.json([]);
      }),
      http.get("https://yield.example.com/health", ({ request }) => {
        calls.push({ headers: request.headers, url: request.url });
        return HttpResponse.json({
          status: "OK",
          timestamp: new Date(0).toISOString(),
        });
      }),
      http.get("https://borrow.example.com/health", ({ request }) => {
        calls.push({ headers: request.headers, url: request.url });
        return HttpResponse.json({
          status: "OK",
          timestamp: new Date(0).toISOString(),
        });
      })
    );
    const client = await createTestClient();

    await Effect.runPromise(client.legacy.TokenControllerGetTokens(undefined));
    await Effect.runPromise(client.yield.HealthControllerHealth(undefined));
    await Effect.runPromise(client.borrow.HealthControllerHealth(undefined));

    expect(calls.map((call) => call.url)).toEqual([
      "https://api.example.com/v1/tokens",
      "https://yield.example.com/health",
      "https://borrow.example.com/health",
    ]);
    expect(
      calls.every((call) => call.headers.get("X-API-KEY") === "test-key")
    ).toBe(true);
  });

  it("fails the layer when Borrow API configuration is missing", async () => {
    await expect(
      createTestClient({ borrowApiUrl: " " })
    ).rejects.toBeInstanceOf(MissingBorrowApiConfig);
  });

  it("records rich errors and geo-block responses", async ({ worker }) => {
    const richError = await renderHook(() => useRichErrors());
    const geoBlock = await renderHook(() => useGeoBlock());
    richError.result.current.resetError();
    const apiUrl = normalizeUrl(config.env.apiUrl);
    let response: "rich" | "geo" = "rich";
    worker.use(
      http.get(`${apiUrl}/v1/tokens`, () =>
        response === "rich"
          ? HttpResponse.json(
              {
                code: 400,
                details: { code: "TEST" },
                message: "Rich failure",
              },
              { status: 400 }
            )
          : HttpResponse.json(
              {
                countryCode: "CA",
                message: "Access denied",
                regionCode: "CA-ON",
                tags: ["staking"],
                type: "GEO_LOCATION",
              },
              { status: 403 }
            )
      )
    );
    const client = await createTestClient({ baseUrl: apiUrl });

    try {
      await expect(
        Effect.runPromise(client.legacy.TokenControllerGetTokens(undefined))
      ).rejects.toBeTruthy();
      await expect
        .poll(() => richError.result.current.error?.message)
        .toBe("Rich failure");

      response = "geo";
      await expect(
        Effect.runPromise(client.legacy.TokenControllerGetTokens(undefined))
      ).rejects.toBeTruthy();
      await expect
        .poll(() => {
          const value = geoBlock.result.current;
          return value === false ? undefined : value.countryCode;
        })
        .toBe("CA");
    } finally {
      richError.unmount();
      geoBlock.unmount();
    }
  });

  it("retries only transient response statuses", async ({ worker }) => {
    let transientAttempts = 0;
    let badRequestAttempts = 0;
    worker.use(
      http.get("https://api.example.com/v1/tokens", () => {
        transientAttempts += 1;
        return transientAttempts < 3
          ? HttpResponse.json(
              { code: 500, message: "temporary" },
              { status: 500 }
            )
          : HttpResponse.json([]);
      })
    );
    const client = await createTestClient();

    await Effect.runPromise(client.legacy.TokenControllerGetTokens(undefined));
    expect(transientAttempts).toBe(3);

    worker.use(
      http.get("https://api.example.com/v1/tokens", () => {
        badRequestAttempts += 1;
        return HttpResponse.json(
          { code: 400, message: "bad request" },
          { status: 400 }
        );
      })
    );
    await expect(
      Effect.runPromise(client.legacy.TokenControllerGetTokens(undefined))
    ).rejects.toBeTruthy();
    expect(badRequestAttempts).toBe(1);
  });

  it("waits for delayed API requests before resolving", async ({ worker }) => {
    const env = config.env as unknown as { isTestMode: boolean };
    const originalIsTestMode = env.isTestMode;
    env.isTestMode = false;
    const releaseDelay = delayAPIRequests();
    let resolved = false;
    worker.use(
      http.get("https://api.example.com/v1/tokens", () => HttpResponse.json([]))
    );
    const client = await createTestClient();

    try {
      const request = Effect.runPromise(
        client.legacy.TokenControllerGetTokens(undefined)
      ).then(() => {
        resolved = true;
      });

      await Promise.resolve();
      expect(resolved).toBe(false);
      releaseDelay();
      await request;
      expect(resolved).toBe(true);
    } finally {
      releaseDelay();
      env.isTestMode = originalIsTestMode;
    }
  });
});
