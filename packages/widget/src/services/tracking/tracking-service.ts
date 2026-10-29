import { Context, Effect, Layer } from "effect";
import { config } from "../../shared/config/widget-defaults";
import { WidgetConfigService } from "../config/widget-config";
import {
  type AnyTrackEventProperties,
  type AnyTrackPageProperties,
  type TrackEventArgs,
  type TrackEventKey,
  type TrackPageArgs,
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

      const sendEvent = Effect.fn("TrackingService.trackEvent")(
        function* (event: TrackEventKey, properties?: AnyTrackEventProperties) {
          const { hostProfile, tracking } = yield* widgetConfig.current;
          const variantTracking = hostProfile.hostTracking
            ? yield* getVariantTracking
            : undefined;

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
        (effect) => Effect.ignore(effect)
      );

      const sendPageView = Effect.fn("TrackingService.trackPageView")(
        function* (page: TrackPageKey, properties?: AnyTrackPageProperties) {
          const { hostProfile, tracking } = yield* widgetConfig.current;
          const variantTracking = hostProfile.hostTracking
            ? yield* getVariantTracking
            : undefined;

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
        (effect) => Effect.ignore(effect)
      );

      return {
        trackEvent: <Event extends TrackEventKey>(
          event: Event,
          ...[properties]: TrackEventArgs<Event>
        ) => sendEvent(event, properties),
        trackPageView: <Page extends TrackPageKey>(
          page: Page,
          ...[properties]: TrackPageArgs<Page>
        ) => sendPageView(page, properties),
      } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(TrackingService, TrackingService.make);
}
