import { Effect, Layer, Stream } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeWidgetConfig } from "../../src/app/config";
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

  it("resolves the latest live tracking configuration per invocation", async () => {
    const firstTrackEvent = vi.fn();
    const secondTrackEvent = vi.fn();
    const trackPageView = vi.fn();
    let input = normalizeWidgetConfig({
      apiKey: "",
      tracking: { trackEvent: firstTrackEvent, trackPageView },
      variant: "default",
    });
    const layer = TrackingService.layer.pipe(
      Layer.provide(
        WidgetConfigService.layer({
          initial: input,
          changes: Stream.never,
          current: Effect.sync(() => input),
        })
      )
    );

    await Effect.runPromise(
      TrackingService.use((tracking) =>
        Effect.gen(function* () {
          yield* tracking.trackEvent("txSigned", { txId: "first" });
          input = normalizeWidgetConfig({
            apiKey: "",
            tracking: { trackEvent: secondTrackEvent, trackPageView },
            variant: "default",
          });
          yield* tracking.trackEvent("txSubmitted", { txId: "second" });
          yield* tracking.trackPageView("earn", { source: "test" });
        })
      ).pipe(Effect.provide(layer))
    );

    expect(firstTrackEvent).toHaveBeenCalledOnce();
    expect(firstTrackEvent).toHaveBeenCalledWith("Transaction signed", {
      txId: "first",
    });
    expect(secondTrackEvent).toHaveBeenCalledOnce();
    expect(secondTrackEvent).toHaveBeenCalledWith("Transaction submitted", {
      txId: "second",
    });
    expect(trackPageView).toHaveBeenCalledWith("Earn", { source: "test" });
  });

  it("initializes variant tracking once during layer construction", async () => {
    const input = normalizeWidgetConfig({
      apiKey: "",
      chainModal: () => null,
      tracking: undefined,
      variant: "zerion",
    });
    const layer = TrackingService.layer.pipe(
      Layer.provide(
        WidgetConfigService.layer({
          initial: input,
          changes: Stream.never,
          current: Effect.succeed(input),
        })
      )
    );

    await Effect.runPromise(
      TrackingService.use((tracking) =>
        Effect.all([
          tracking.trackEvent("txSigned", { txId: "first" }),
          tracking.trackEvent("txSubmitted", { txId: "second" }),
          tracking.trackPageView("positions"),
        ])
      ).pipe(Effect.provide(layer))
    );

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
  });
});
