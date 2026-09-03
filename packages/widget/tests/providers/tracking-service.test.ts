import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { vi } from "vitest";
import { WidgetConfigService } from "../../src/services/config/widget-config";
import { TrackingService } from "../../src/services/tracking/tracking-service";

const variantTracking = vi.hoisted(() => ({
  initMixpanel: vi.fn(),
  trackEvent: vi.fn(),
  trackPageView: vi.fn(),
}));

vi.mock("../../src/services/tracking/tracking-variants", () => ({
  initMixpanel: variantTracking.initMixpanel,
  tracking: {
    trackEvent: variantTracking.trackEvent,
    trackPageView: variantTracking.trackPageView,
  },
}));

describe("tracking service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.effect(
    "resolves the latest live tracking configuration per invocation",
    () =>
      Effect.gen(function* () {
        const firstTrackEvent = vi.fn();
        const secondTrackEvent = vi.fn();
        const trackPageView = vi.fn();
        const input = {
          apiKey: "test-api-key",
          tracking: { trackEvent: firstTrackEvent, trackPageView },
          variant: "default" as const,
        };
        const configLayer = WidgetConfigService.layer(input);
        const layer = Layer.merge(
          configLayer,
          TrackingService.layer.pipe(Layer.provide(configLayer))
        );

        yield* TrackingService.use((tracking) =>
          Effect.gen(function* () {
            const config = yield* WidgetConfigService;
            yield* tracking.trackEvent("txSigned", { txId: "first" });
            yield* config.update({
              apiKey: "test-api-key",
              tracking: { trackEvent: secondTrackEvent, trackPageView },
              variant: "default",
            });
            yield* tracking.trackEvent("txSubmitted", { txId: "second" });
            yield* tracking.trackPageView("earn", { source: "test" });
          })
        ).pipe(Effect.provide(layer));

        expect(firstTrackEvent).toHaveBeenCalledOnce();
        expect(firstTrackEvent).toHaveBeenCalledWith("Transaction signed", {
          txId: "first",
        });
        expect(secondTrackEvent).toHaveBeenCalledOnce();
        expect(secondTrackEvent).toHaveBeenCalledWith("Transaction submitted", {
          txId: "second",
        });
        expect(trackPageView).toHaveBeenCalledWith("Earn", { source: "test" });
      })
  );

  it.effect("initializes variant tracking once during layer construction", () =>
    Effect.gen(function* () {
      const input = {
        apiKey: "test-api-key",
        chainModal: () => null,
        variant: "zerion" as const,
      };
      const layer = TrackingService.layer.pipe(
        Layer.provide(WidgetConfigService.layer(input))
      );

      yield* TrackingService.use((tracking) =>
        Effect.all([
          tracking.trackEvent("txSigned", { txId: "first" }),
          tracking.trackEvent("txSubmitted", { txId: "second" }),
          tracking.trackPageView("positions"),
        ])
      ).pipe(Effect.provide(layer));

      expect(variantTracking.initMixpanel).toHaveBeenCalledTimes(1);
      expect(variantTracking.trackEvent).toHaveBeenNthCalledWith(
        1,
        "Transaction signed",
        { txId: "first" }
      );
      expect(variantTracking.trackEvent).toHaveBeenNthCalledWith(
        2,
        "Transaction submitted",
        { txId: "second" }
      );
      expect(variantTracking.trackPageView).toHaveBeenCalledWith("Positions");
    })
  );
});
