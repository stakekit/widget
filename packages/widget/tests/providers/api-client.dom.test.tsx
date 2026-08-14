import { RegistryProvider } from "@effect/atom-react";
import {
  Context,
  Effect,
  Layer,
  Option,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect";
import { HttpResponse, http } from "msw";
import { version as widgetVersion } from "../../package.json";
import { ActionCommand } from "../../src/domain/action/models";
import {
  mountAnimationStateAtom,
  useMountAnimation,
} from "../../src/features/mount-animation/state";
import { BorrowOperations } from "../../src/services/api/borrow-operations";
import { BorrowResourceSource } from "../../src/services/api/borrow-resource-source";
import { GeoBlockService } from "../../src/services/api/geo-block-state";
import { LegacyResourceSource } from "../../src/services/api/legacy-resource-source";
import { ApiTransportService } from "../../src/services/api/transport";
import { YieldOperations } from "../../src/services/api/yield-operations";
import { YieldResourceSource } from "../../src/services/api/yield-resource-source";
import {
  type ApplicationApiIdentity,
  WidgetConfigService,
} from "../../src/services/config/widget-config";
import { RichErrorService } from "../../src/services/errors/rich-error-service";
import { config } from "../../src/shared/config/widget-defaults";
import { describe, expect, it } from "../utils/test-extend.dom.ts";
import { render } from "../utils/test-utils.dom.tsx";

const MountPresentationProbe = () => {
  const { mountAnimationFinished } = useMountAnimation();

  return (
    <output data-testid="mount-presentation">
      {mountAnimationFinished ? "live" : "frozen"}
    </output>
  );
};

const createTestClient = async (
  options: Partial<ApplicationApiIdentity> = {}
) => {
  const config = {
    apiKey: "test-key",
    baseUrl: "https://api.example.com",
    borrowEnabled: true,
    borrowApiUrl: "https://borrow.example.com",
    dashboardVariant: true,
    yieldsApiUrl: "https://yield.example.com",
    variant: "default" as const,
    ...options,
  };
  const configLayer = WidgetConfigService.layer(config);
  const richErrorLayer = RichErrorService.layer.pipe(
    Layer.provide(configLayer)
  );
  const geoBlockLayer = GeoBlockService.layer;
  const transportLayer = ApiTransportService.layer.pipe(
    Layer.provide(geoBlockLayer),
    Layer.provide(richErrorLayer),
    Layer.provide(configLayer)
  );
  const clientLayer = Layer.mergeAll(
    BorrowOperations.layer,
    BorrowResourceSource.layer,
    LegacyResourceSource.layer,
    YieldOperations.layer,
    YieldResourceSource.layer
  ).pipe(Layer.provide(transportLayer), Layer.provide(configLayer));
  const context = await Effect.runPromise(
    Layer.build(
      Layer.mergeAll(clientLayer, geoBlockLayer, richErrorLayer)
    ).pipe(Effect.scoped)
  );

  return {
    client: {
      borrowOperations: Context.get(context, BorrowOperations),
      borrowSource: Context.get(context, BorrowResourceSource),
      legacySource: Context.get(context, LegacyResourceSource),
      yieldOperations: Context.get(context, YieldOperations),
      yieldSource: Context.get(context, YieldResourceSource),
    },
    geoBlock: Context.get(context, GeoBlockService),
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

  it("keeps resource transports neutral while operations publish rich errors", async ({
    worker,
  }) => {
    const apiUrl = normalizeUrl(config.env.apiUrl);
    let response: "rich" | "geo" = "rich";
    const richFailure = {
      code: 400,
      details: { code: "TEST" },
      message: "Rich failure",
    };
    worker.use(
      http.get(`${apiUrl}/v1/tokens`, () =>
        response === "rich"
          ? HttpResponse.json(richFailure, { status: 400 })
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
      ),
      http.post("https://yield.example.com/v1/actions/enter", () =>
        HttpResponse.json(richFailure, { status: 400 })
      ),
      http.get("https://yield.example.com/health", () =>
        HttpResponse.json(richFailure, { status: 400 })
      ),
      http.get("https://borrow.example.com/v1/integrations", () =>
        HttpResponse.json(richFailure, { status: 400 })
      )
    );
    const { client, geoBlock, richErrors } = await createTestClient({
      baseUrl: apiUrl,
    });

    try {
      const resourceError = await Effect.runPromise(
        client.legacySource.getTokenOptions().pipe(Effect.flip)
      );
      expect(resourceError._tag).toBe("ApiRequestError");
      if (resourceError._tag !== "ApiRequestError") {
        throw resourceError;
      }
      expect(resourceError.richError?.message).toBe("Rich failure");
      await expect(
        Effect.runPromise(client.yieldSource.getHealth())
      ).rejects.toBeTruthy();
      await expect(
        Effect.runPromise(client.borrowSource.getIntegrations())
      ).rejects.toBeTruthy();
      await expect(
        Effect.runPromise(SubscriptionRef.get(richErrors.current))
      ).resolves.toBeNull();

      await expect(
        Effect.runPromise(
          client.yieldOperations.previewAction({
            command: Schema.decodeUnknownSync(ActionCommand)({
              address: "0xWallet",
              yieldId: "ethereum-eth-native-staking",
            }),
            intent: "enter",
          })
        )
      ).rejects.toBeTruthy();
      await expect
        .poll(() =>
          Effect.runPromise(SubscriptionRef.get(richErrors.current)).then(
            (error) => error?.message
          )
        )
        .toBe("Rich failure");
      await Effect.runPromise(richErrors.reset);

      response = "geo";
      await expect(
        Effect.runPromise(client.legacySource.getTokenOptions())
      ).rejects.toBeTruthy();
      await expect
        .poll(() =>
          Effect.runPromise(
            geoBlock.states.pipe(Stream.runHead, Effect.map(Option.getOrThrow))
          ).then((value) => (value === false ? undefined : value.countryCode))
        )
        .toBe("CA");
    } finally {
      await Effect.runPromise(richErrors.reset);
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

  it("resolves API responses while mount presentation remains frozen", async ({
    worker,
  }) => {
    worker.use(
      http.get("https://api.example.com/v1/tokens", () => HttpResponse.json([]))
    );
    const { client } = await createTestClient();
    const presentation = await render(
      <RegistryProvider
        initialValues={[
          [
            mountAnimationStateAtom,
            {
              earnPage: false,
              layout: false,
            },
          ],
        ]}
      >
        <MountPresentationProbe />
      </RegistryProvider>
    );

    try {
      await Effect.runPromise(client.legacySource.getTokenOptions());

      expect(
        presentation.container.querySelector(
          "[data-testid='mount-presentation']"
        )?.textContent
      ).toBe("frozen");
    } finally {
      presentation.unmount();
    }
  });
});
