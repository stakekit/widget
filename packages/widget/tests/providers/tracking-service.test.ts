import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultWidgetBootstrapConfig,
  WidgetBootstrapConfig,
} from "../../src/services/config/widget-config";
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

  it("captures immutable tracking configuration during layer construction", async () => {
    const trackEvent = vi.fn();
    const trackPageView = vi.fn();
    const layer = TrackingService.layer.pipe(
      Layer.provide(
        WidgetBootstrapConfig.layer({
          ...defaultWidgetBootstrapConfig,
          tracking: {
            tracking: { trackEvent, trackPageView },
            variant: "default",
          },
        })
      )
    );

    await Effect.runPromise(
      TrackingService.use((tracking) =>
        Effect.all([
          tracking.trackEvent("txSigned", { txId: "first" }),
          tracking.trackEvent("txSubmitted", { txId: "second" }),
          tracking.trackPageView("earn", { source: "test" }),
        ])
      ).pipe(Effect.provide(layer))
    );

    expect(trackEvent).toHaveBeenNthCalledWith(1, "Transaction signed", {
      txId: "first",
    });
    expect(trackEvent).toHaveBeenNthCalledWith(2, "Transaction submitted", {
      txId: "second",
    });
    expect(trackPageView).toHaveBeenCalledWith("Earn", { source: "test" });
  });

  it("initializes variant tracking once during layer construction", async () => {
    const layer = TrackingService.layer.pipe(
      Layer.provide(
        WidgetBootstrapConfig.layer({
          ...defaultWidgetBootstrapConfig,
          tracking: {
            tracking: undefined,
            variant: "zerion",
          },
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
