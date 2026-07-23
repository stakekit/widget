import { Context, Effect, Layer, Stream, SubscriptionRef } from "effect";
import { HttpResponse, http } from "msw";
import { version as widgetVersion } from "../../package.json";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import { useGeoBlock } from "../../src/features/preferences/react/use-geo-block";
import { BorrowOperations } from "../../src/services/api/borrow-operations";
import { BorrowResourceSource } from "../../src/services/api/borrow-resource-source";
import { delayAPIRequests } from "../../src/services/api/delay-api-requests";
import { LegacyResourceSource } from "../../src/services/api/legacy-resource-source";
import { ApiTransportService } from "../../src/services/api/transport";
import { YieldOperations } from "../../src/services/api/yield-operations";
import { YieldResourceSource } from "../../src/services/api/yield-resource-source";
import {
  type WidgetApiConfig,
  WidgetConfigService,
} from "../../src/services/config/widget-config";
import { RichErrorService } from "../../src/services/errors/rich-error-service";
import { config } from "../../src/shared/config/widget-defaults";
import { describe, expect, it } from "../utils/test-extend.dom";
import { renderHook } from "../utils/test-utils.dom";

const createTestClient = async (options: Partial<WidgetApiConfig> = {}) => {
  const config = normalizeWidgetConfig({
    apiKey: "test-key",
    baseUrl: "https://api.example.com",
    borrowApiUrl: "https://borrow.example.com",
    yieldsApiUrl: "https://yield.example.com",
    variant: "default",
    ...options,
  });
  const configLayer = WidgetConfigService.layer({
    initial: config,
    changes: Stream.never,
    current: Effect.succeed(config),
  });
  const richErrorLayer = RichErrorService.layer.pipe(
    Layer.provide(configLayer)
  );
  const transportLayer = ApiTransportService.layer.pipe(
    Layer.provide(richErrorLayer),
    Layer.provide(configLayer)
  );
  const clientLayer = Layer.mergeAll(
    BorrowOperations.layer,
    BorrowResourceSource.layer,
    LegacyResourceSource.layer,
    YieldOperations.layer,
    YieldResourceSource.layer
  ).pipe(Layer.provide(transportLayer));
  const context = await Effect.runPromise(
    Layer.build(Layer.merge(clientLayer, richErrorLayer)).pipe(Effect.scoped)
  );

  return {
    client: {
      borrowOperations: Context.get(context, BorrowOperations),
      borrowSource: Context.get(context, BorrowResourceSource),
      legacySource: Context.get(context, LegacyResourceSource),
      yieldOperations: Context.get(context, YieldOperations),
      yieldSource: Context.get(context, YieldResourceSource),
    },
    richErrors: Context.get(context, RichErrorService),
  };
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
          timestamp: "1970-01-01T00:00:00.000Z",
        });
      }),
      http.get("https://borrow.example.com/v1/integrations", ({ request }) => {
        calls.push({ headers: request.headers, url: request.url });
        return HttpResponse.json([]);
      })
    );
    const { client } = await createTestClient();

    await Effect.runPromise(client.legacySource.getTokenOptions());
    await Effect.runPromise(client.yieldSource.getHealth());
    await Effect.runPromise(client.borrowSource.getIntegrations());

    expect(calls.map((call) => call.url)).toEqual([
      "https://api.example.com/v1/tokens",
      "https://yield.example.com/health",
      "https://borrow.example.com/v1/integrations",
    ]);
    expect(
      calls.every((call) => call.headers.get("X-API-KEY") === "test-key")
    ).toBe(true);
    expect(
      calls.every(
        (call) => call.headers.get("X-Yield-Widget-Version") === widgetVersion
      )
    ).toBe(true);
  });

  it("keeps Borrow operations unavailable when configuration is missing", async () => {
    const { client } = await createTestClient({ borrowApiUrl: " " });
    await expect(
      Effect.runPromise(client.borrowSource.getIntegrations())
    ).rejects.toBeTruthy();
  });

  it("records rich errors and geo-block responses", async ({ worker }) => {
    const geoBlock = await renderHook(() => useGeoBlock());
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
    const { client, richErrors } = await createTestClient({ baseUrl: apiUrl });

    try {
      await geoBlock.act(async () => {
        await expect(
          Effect.runPromise(client.legacySource.getTokenOptions())
        ).rejects.toBeTruthy();
        await expect
          .poll(() =>
            Effect.runPromise(SubscriptionRef.get(richErrors.current)).then(
              (error) => error?.message
            )
          )
          .toBe("Rich failure");

        response = "geo";
        await expect(
          Effect.runPromise(client.legacySource.getTokenOptions())
        ).rejects.toBeTruthy();
        await expect
          .poll(() => {
            const value = geoBlock.result.current;
            return value === false ? undefined : value.countryCode;
          })
          .toBe("CA");
      });
    } finally {
      await geoBlock.act(() => Effect.runPromise(richErrors.reset));
      geoBlock.unmount();
    }
  });

  it("retries transient response statuses for every API", async ({
    worker,
  }) => {
    const transientAttempts = {
      borrow: 0,
      legacy: 0,
      yield: 0,
    };
    let badRequestAttempts = 0;
    worker.use(
      http.get("https://api.example.com/v1/tokens", () => {
        transientAttempts.legacy += 1;
        return transientAttempts.legacy < 3
          ? HttpResponse.json(
              { code: 500, message: "temporary" },
              { status: 500 }
            )
          : HttpResponse.json([]);
      }),
      http.get("https://yield.example.com/health", () => {
        transientAttempts.yield += 1;
        return transientAttempts.yield < 3
          ? HttpResponse.json(
              { code: 500, message: "temporary" },
              { status: 500 }
            )
          : HttpResponse.json({
              status: "OK",
              timestamp: "1970-01-01T00:00:00.000Z",
            });
      }),
      http.get("https://borrow.example.com/v1/integrations", () => {
        transientAttempts.borrow += 1;
        return transientAttempts.borrow < 3
          ? HttpResponse.json(
              { code: 500, message: "temporary" },
              { status: 500 }
            )
          : HttpResponse.json([]);
      })
    );
    const { client } = await createTestClient();

    await Effect.runPromise(client.legacySource.getTokenOptions());
    await Effect.runPromise(client.yieldSource.getHealth());
    await Effect.runPromise(client.borrowSource.getIntegrations());
    expect(transientAttempts).toEqual({ borrow: 3, legacy: 3, yield: 3 });

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
      Effect.runPromise(client.legacySource.getTokenOptions())
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
    const { client } = await createTestClient();

    try {
      const request = Effect.runPromise(
        client.legacySource.getTokenOptions()
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
