import { Context, Effect, Layer } from "effect";
import { config } from "../../config";
import { WidgetBootstrapConfig } from "../effect-atom-runtime/bootstrap-config";
import { type Properties, type TrackEventKey, trackEventMap } from "./types";

export class TrackingService extends Context.Service<TrackingService>()(
  "stakekit/widget/TrackingService",
  {
    make: Effect.gen(function* () {
      const { tracking, variant } = (yield* WidgetBootstrapConfig).tracking;
      const variantTracking =
        variant === "zerion"
          ? yield* Effect.tryPromise({
              try: async () => {
                const module = await import("./tracking-variants");
                module.initMixpanel(config.zerion.tracking);
                return module.tracking;
              },
              catch: () => undefined,
            }).pipe(Effect.orElseSucceed(() => undefined))
          : undefined;

      const trackEvent = Effect.fn("TrackingService.trackEvent")(
        function* (event: TrackEventKey, properties?: Properties) {
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

      return { trackEvent } as const;
    }),
  }
) {
  static readonly layer = Layer.effect(TrackingService, TrackingService.make);
}
