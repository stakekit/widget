import { Context, Effect, Layer } from "effect";
import { config } from "../../shared/config/widget-defaults";
import { WidgetConfigService } from "../config/widget-config";
import {
  type Properties,
  type TrackEventKey,
  type TrackPageKey,
  trackEventMap,
  trackPageMap,
} from "./types";

export class TrackingService extends Context.Service<TrackingService>()(
  "stakekit/widget/TrackingService",
  {
    make: Effect.gen(function* () {
      const widgetConfig = yield* WidgetConfigService;
      const getVariantTracking = yield* Effect.cached(
        Effect.tryPromise({
          try: async () => {
            const module = await import("./tracking-variants");
            module.initMixpanel(config.zerion.tracking);
            return module.tracking;
          },
          catch: () => undefined,
        }).pipe(Effect.orElseSucceed(() => undefined))
      );

      const trackEvent = Effect.fn("TrackingService.trackEvent")(
        function* (event: TrackEventKey, properties?: Properties) {
          const { tracking, variant } = yield* widgetConfig.current;
          const variantTracking =
            variant === "zerion" ? yield* getVariantTracking : undefined;

          yield* Effect.try({
            try: () =>
              tracking?.trackEvent?.(
                trackEventMap[event],
                ...(properties ? [properties] : [])
              ),
            catch: () => undefined,
          });

          yield* Effect.try({
            try: () =>
              variantTracking?.trackEvent?.(
                trackEventMap[event],
                ...(properties ? [properties] : [])
              ),
            catch: () => undefined,
          });
        },
        Effect.catch(() => Effect.void)
      );

      const trackPageView = Effect.fn("TrackingService.trackPageView")(
        function* (page: TrackPageKey, properties?: Properties) {
          const { tracking, variant } = yield* widgetConfig.current;
          const variantTracking =
            variant === "zerion" ? yield* getVariantTracking : undefined;

          yield* Effect.try({
            try: () =>
              tracking?.trackPageView?.(
                trackPageMap[page],
                ...(properties ? [properties] : [])
              ),
            catch: () => undefined,
          });

          yield* Effect.try({
            try: () =>
              variantTracking?.trackPageView?.(
                trackPageMap[page],
                ...(properties ? [properties] : [])
              ),
            catch: () => undefined,
          });
        },
        Effect.catch(() => Effect.void)
      );

      return { trackEvent, trackPageView } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(TrackingService, TrackingService.make);
}
