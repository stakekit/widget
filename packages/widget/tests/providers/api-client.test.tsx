import { HttpResponse, http } from "msw";
import { delayAPIRequests } from "../../src/common/delay-api-requests";
import { config } from "../../src/config";
import { useGeoBlock } from "../../src/hooks/use-geo-block";
import { useRichErrors } from "../../src/hooks/use-rich-errors";
import { createApiClient } from "../../src/providers/api/api-client";
import { describe, expect, it } from "../utils/test-extend";
import { renderHook } from "../utils/test-utils";

const createTestClient = (
  options: Partial<Parameters<typeof createApiClient>[0]> = {}
) =>
  createApiClient({
    apiKey: "test-key",
    baseUrl: "https://api.example.com",
    yieldsApiUrl: "https://yield.example.com",
    ...options,
  });

const normalizeUrl = (url: string) => url.replace(/\/$/, "");

describe("API client", () => {
  it("constructs bound generated legacy and Yield clients with shared headers", async ({
    worker,
  }) => {
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
      })
    );
    const client = createTestClient();

    await expect(
      client.legacy.TokenControllerGetTokens(undefined)
    ).resolves.toEqual([]);
    await expect(
      client.yield.HealthControllerHealth(undefined)
    ).resolves.toMatchObject({
      status: "OK",
    });

    expect(calls.map((call) => call.url)).toEqual([
      "https://api.example.com/v1/tokens",
      "https://yield.example.com/health",
    ]);
    expect(
      calls.every((call) => call.headers.get("X-API-KEY") === "test-key")
    ).toBe(true);
  });

  it("exposes only the generated operations currently used by the app", () => {
    const client = createTestClient();

    expect("TokenControllerGetTokens" in client.legacy).toBe(true);
    expect("AuthControllerMe" in client.legacy).toBe(false);
    expect("YieldsControllerGetAggregateBalances" in client.yield).toBe(true);
    expect("ProvidersControllerGetProvider" in client.yield).toBe(true);
    expect("ProvidersControllerGetProviders" in client.yield).toBe(false);
  });

  it("records rich errors for failed StakeKit API responses", async ({
    worker,
  }) => {
    const richError = await renderHook(() => useRichErrors());
    richError.result.current.resetError();
    const apiUrl = normalizeUrl(config.env.apiUrl);
    worker.use(
      http.get(`${apiUrl}/v1/tokens`, () =>
        HttpResponse.json(
          { code: 400, details: { code: "TEST" }, message: "Rich failure" },
          { status: 400 }
        )
      )
    );
    const client = createTestClient({ baseUrl: apiUrl });

    try {
      await expect(
        client.legacy.TokenControllerGetTokens(undefined)
      ).rejects.toMatchObject({
        _tag: "TokenControllerGetTokens400",
        response: { status: 400 },
      });
      await expect
        .poll(() => richError.result.current.error?.message)
        .toBe("Rich failure");
    } finally {
      richError.unmount();
    }
  });

  it("can suppress rich errors for optional API requests", async ({
    worker,
  }) => {
    const richError = await renderHook(() => useRichErrors());
    richError.result.current.resetError();
    const apiUrl = normalizeUrl(config.env.apiUrl);
    worker.use(
      http.get(`${apiUrl}/v1/tokens`, () =>
        HttpResponse.json(
          {
            code: 400,
            details: { code: "TEST" },
            message: "Optional failure",
          },
          { status: 400 }
        )
      )
    );
    const client = createTestClient({ baseUrl: apiUrl });

    try {
      await expect(
        client
          .withOptions({ suppressRichErrors: true })
          .legacy.TokenControllerGetTokens(undefined)
      ).rejects.toMatchObject({
        _tag: "TokenControllerGetTokens400",
        response: { status: 400 },
      });
      await Promise.resolve();

      expect(richError.result.current.error).toBeNull();
    } finally {
      richError.unmount();
    }
  });

  it("records geo-block responses", async ({ worker }) => {
    const geoBlock = await renderHook(() => useGeoBlock());
    const apiUrl = normalizeUrl(config.env.apiUrl);
    worker.use(
      http.get(`${apiUrl}/v1/tokens`, () =>
        HttpResponse.json(
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
    const client = createTestClient({ baseUrl: apiUrl });

    try {
      await expect(
        client.legacy.TokenControllerGetTokens(undefined)
      ).rejects.toBeTruthy();
      await expect
        .poll(() => {
          const value = geoBlock.result.current;

          return value === false ? undefined : value.countryCode;
        })
        .toBe("CA");

      const value = geoBlock.result.current;
      expect(value === false ? [] : [...value.tags]).toEqual(["staking"]);
    } finally {
      geoBlock.unmount();
    }
  });

  it("retries transient response statuses", async ({ worker }) => {
    let attempts = 0;
    worker.use(
      http.get("https://api.example.com/v1/tokens", () => {
        attempts += 1;

        return attempts < 3
          ? HttpResponse.json(
              { code: 500, message: "temporary" },
              { status: 500 }
            )
          : HttpResponse.json([]);
      })
    );
    const client = createTestClient();

    await expect(
      client.legacy.TokenControllerGetTokens(undefined)
    ).resolves.toEqual([]);
    expect(attempts).toBe(3);
  });

  it("does not retry non-transient response statuses", async ({ worker }) => {
    let attempts = 0;
    worker.use(
      http.get("https://api.example.com/v1/tokens", () => {
        attempts += 1;

        return HttpResponse.json(
          { code: 400, message: "bad request" },
          { status: 400 }
        );
      })
    );
    const client = createTestClient();

    await expect(
      client.legacy.TokenControllerGetTokens(undefined)
    ).rejects.toMatchObject({
      _tag: "TokenControllerGetTokens400",
      cause: { code: 400, message: "bad request" },
      response: { status: 400 },
    });
    expect(attempts).toBe(1);
  });

  it("does not retry aborted requests", async ({ worker }) => {
    let attempts = 0;
    const controller = new AbortController();
    worker.use(
      http.get("https://api.example.com/v1/tokens", async ({ request }) => {
        attempts += 1;
        controller.abort();

        await new Promise((resolve) => {
          request.signal.addEventListener("abort", resolve, { once: true });
        });

        return HttpResponse.json([]);
      })
    );
    const client = createTestClient();

    await expect(
      client
        .withOptions({ signal: controller.signal })
        .legacy.TokenControllerGetTokens(undefined)
    ).rejects.toBeTruthy();
    expect(attempts).toBeLessThanOrEqual(1);
  });

  it("waits for delayed API requests before resolving successful responses", async ({
    worker,
  }) => {
    const env = config.env as unknown as { isTestMode: boolean };
    const originalIsTestMode = env.isTestMode;
    env.isTestMode = false;

    const releaseDelay = delayAPIRequests();
    let resolved = false;
    worker.use(
      http.get("https://api.example.com/v1/tokens", () => HttpResponse.json([]))
    );
    const client = createTestClient();

    try {
      const request = client.legacy
        .TokenControllerGetTokens(undefined)
        .then(() => {
          resolved = true;
        });

      await Promise.resolve();
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
