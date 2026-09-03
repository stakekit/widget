import { RegistryProvider } from "@effect/atom-react";
import {
  Cause,
  Context,
  Effect,
  Layer,
  Option,
  Schedule,
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
} from "../../src/features/mount-animation/index";
import {
  BorrowOperations,
  YieldOperations,
} from "../../src/services/api/operations";
import {
  BorrowResourceSource,
  LegacyResourceSource,
  YieldResourceSource,
} from "../../src/services/api/resource-sources";
import { apiLayer } from "../../src/services/api/runtime";
import {
  type ApplicationApiIdentity,
  WidgetConfigService,
} from "../../src/services/config/widget-config";
import { RichErrorService } from "../../src/services/errors/rich-error-service";
import { GeoBlockService } from "../../src/services/geoblocking";
import { config } from "../../src/shared/config/widget-defaults";
import { yieldApiActionDtoFixture } from "../fixtures";
import { describe, expect, it } from "../utils/test-extend.dom.ts";
import { render } from "../utils/test-utils.dom.tsx";

const waitForEffectValue = <A, E, R>(
  self: Effect.Effect<A, E, R>,
  predicate: (value: A) => boolean
) =>
  self.pipe(
    Effect.filterOrFail(
      predicate,
      () => new Cause.UnknownError("Effect value is not ready")
    ),
    Effect.retry({ schedule: Schedule.spaced("10 millis"), times: 100 })
  );

const MountPresentationProbe = () => {
  const { mountAnimationFinished } = useMountAnimation();

  return (
    <output data-testid="mount-presentation">
      {mountAnimationFinished ? "live" : "frozen"}
    </output>
  );
};

const createTestClient = (options: Partial<ApplicationApiIdentity> = {}) =>
  Effect.gen(function* () {
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
    const clientLayer = apiLayer.pipe(
      Layer.provide(geoBlockLayer),
      Layer.provide(richErrorLayer),
      Layer.provide(configLayer)
    );
    const context = yield* Layer.build(
      Layer.mergeAll(clientLayer, geoBlockLayer, richErrorLayer)
    ).pipe(Effect.scoped);

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
  });

const normalizeUrl = (url: string) => url.replace(/\/$/, "");

describe("Effect API client", () => {
  it.live("constructs all typed clients with shared headers", ({ worker }) =>
    Effect.gen(function* () {
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
        http.get(
          "https://borrow.example.com/v1/integrations",
          ({ request }) => {
            calls.push({ headers: request.headers, url: request.url });
            return HttpResponse.json([]);
          }
        )
      );
      const { client } = yield* createTestClient();

      yield* client.legacySource.getTokenOptions({ enter: true });
      yield* client.yieldSource.getHealth;
      yield* client.borrowSource.getIntegrations;

      expect(calls.map((call) => call.url)).toEqual([
        "https://api.example.com/v1/tokens?enter=true",
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
    })
  );

  it.live(
    "keeps Borrow operations unavailable when configuration is missing",
    () =>
      Effect.gen(function* () {
        const { client } = yield* createTestClient({ borrowApiUrl: " " });
        expect(
          yield* Effect.flip(client.borrowSource.getIntegrations)
        ).toBeTruthy();
      })
  );

  it.live(
    "keeps resource transports neutral while operations publish rich errors",
    ({ worker }) =>
      Effect.gen(function* () {
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
        const { client, geoBlock, richErrors } = yield* createTestClient({
          baseUrl: apiUrl,
        });

        try {
          const resourceError = yield* client.legacySource
            .getTokenOptions({ enter: true })
            .pipe(Effect.flip);
          expect(resourceError._tag).toBe("ApiRequestError");
          if (resourceError._tag !== "ApiRequestError") {
            throw resourceError;
          }
          expect(resourceError.richError?.message).toBe("Rich failure");
          expect(yield* Effect.flip(client.yieldSource.getHealth)).toBeTruthy();
          expect(
            yield* Effect.flip(client.borrowSource.getIntegrations)
          ).toBeTruthy();
          expect(yield* SubscriptionRef.get(richErrors.current)).toBeNull();

          const command = yield* Schema.decodeEffect(ActionCommand)({
            address: "0xWallet",
            yieldId: "ethereum-eth-native-staking",
          });
          expect(
            yield* Effect.flip(
              client.yieldOperations.previewAction({
                command,
                intent: "enter",
              })
            )
          ).toBeTruthy();
          yield* waitForEffectValue(
            SubscriptionRef.get(richErrors.current),
            (error) => error?.message === "Rich failure"
          );
          yield* richErrors.reset;

          response = "geo";
          expect(
            yield* Effect.flip(
              client.legacySource.getTokenOptions({ enter: true })
            )
          ).toBeTruthy();
          yield* waitForEffectValue(
            geoBlock.states.pipe(Stream.runHead, Effect.map(Option.getOrThrow)),
            (value) => value !== false && value.countryCode === "CA"
          );
        } finally {
          yield* richErrors.reset;
        }
      })
  );

  it.live("retries transient response statuses for every API", ({ worker }) =>
    Effect.gen(function* () {
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
      const { client } = yield* createTestClient();

      yield* client.legacySource.getTokenOptions({ enter: true });
      yield* client.yieldSource.getHealth;
      yield* client.borrowSource.getIntegrations;
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
      expect(
        yield* Effect.flip(client.legacySource.getTokenOptions({ enter: true }))
      ).toBeTruthy();
      expect(badRequestAttempts).toBe(1);
    })
  );

  it.live(
    "lets geoblocking and unexpected-status observers see the same JSON",
    ({ worker }) =>
      Effect.gen(function* () {
        const limit = 1001;
        worker.use(
          http.get("https://api.example.com/v1/tokens", () =>
            HttpResponse.text(
              `{"countryCode":"CA","limit":${limit},"message":"Access denied","regionCode":"CA-ON","tags":["staking"],"type":"GEO_LOCATION"}`,
              { headers: { "Content-Type": "application/json" }, status: 403 }
            )
          ),
          http.get("https://yield.example.com/health", () =>
            HttpResponse.text(`{"limit":${limit}}`, {
              headers: { "Content-Type": "application/json" },
              status: 418,
            })
          )
        );
        const { client, geoBlock } = yield* createTestClient();
        const unexpected = yield* client.yieldSource.getHealth.pipe(
          Effect.flip
        );

        expect(
          yield* Effect.flip(
            client.legacySource.getTokenOptions({ enter: true })
          )
        ).toBeTruthy();
        yield* waitForEffectValue(
          geoBlock.states.pipe(Stream.runHead, Effect.map(Option.getOrThrow)),
          (value) => value !== false && value.countryCode === "CA"
        );
        expect(unexpected._tag).toBe("ApiRequestError");
        if (unexpected._tag !== "ApiRequestError") {
          throw unexpected;
        }
        expect(
          String((unexpected.cause as { message?: string }).message)
        ).toContain(String(limit));
      })
  );

  it.live(
    "decodes a quoted Action amount that cannot pass through JavaScript number",
    ({ worker }) =>
      Effect.gen(function* () {
        const amount = "1.000000000000000001";
        const amountRaw = "1000000000000000001";
        worker.use(
          http.post("https://yield.example.com/v1/actions/enter", () =>
            HttpResponse.text(
              JSON.stringify(
                yieldApiActionDtoFixture({
                  amount,
                  amountRaw,
                  amountUsd: "1",
                })
              ),
              { headers: { "Content-Type": "application/json" }, status: 201 }
            )
          )
        );
        const { client } = yield* createTestClient();
        const command = yield* Schema.decodeEffect(ActionCommand)({
          address: "0x1234567890123456789012345678901234567890",
          arguments: { amount },
          yieldId: "ethereum-eth-native-staking",
        });
        const action = yield* client.yieldOperations.previewAction({
          command,
          intent: "enter",
        });

        expect(action.amount?.toFixed()).toBe(amount);
        expect(action.amountRaw).toBe(BigInt(amountRaw));
      })
  );

  it.live(
    "resolves API responses while mount presentation remains frozen",
    ({ worker }) =>
      Effect.gen(function* () {
        worker.use(
          http.get("https://api.example.com/v1/tokens", () =>
            HttpResponse.json([])
          )
        );
        const { client } = yield* createTestClient();
        const presentation = yield* Effect.promise(() =>
          render(
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
          )
        );

        try {
          yield* client.legacySource.getTokenOptions({ enter: true });

          expect(
            presentation.container.querySelector(
              "[data-testid='mount-presentation']"
            )?.textContent
          ).toBe("frozen");
        } finally {
          presentation.unmount();
        }
      })
  );
});
