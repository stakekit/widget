import { Effect, Layer, Ref } from "effect";
import { TrackingService } from "../../../src/services/tracking/tracking-service";
import type {
  AnyTrackEventProperties,
  AnyTrackPageProperties,
  TrackEventKey,
  TrackPageKey,
} from "../../../src/services/tracking/types";

export type TrackedEvent = Readonly<{
  readonly event: TrackEventKey;
  readonly properties?: AnyTrackEventProperties;
}>;

export type TrackedPageView = Readonly<{
  readonly page: TrackPageKey;
  readonly properties?: AnyTrackPageProperties;
}>;

export type TestTrackingOptions = Readonly<{
  readonly trackEvent?: (
    event: TrackEventKey,
    properties?: AnyTrackEventProperties
  ) => Effect.Effect<void>;
}>;

export const makeTestTracking = Effect.fn("makeTestTracking")(function* (
  options: TestTrackingOptions = {}
) {
  const events = yield* Ref.make<ReadonlyArray<TrackedEvent>>([]);
  const pageViews = yield* Ref.make<ReadonlyArray<TrackedPageView>>([]);
  const trackEvent = Effect.fn("makeTestTracking.trackEvent")(function* (
    event: TrackEventKey,
    properties?: AnyTrackEventProperties
  ) {
    yield* Ref.update(events, (current) => [
      ...current,
      properties === undefined ? { event } : { event, properties },
    ]);
    if (!options.trackEvent) return;
    if (properties === undefined) {
      yield* options.trackEvent(event);
      return;
    }
    yield* options.trackEvent(event, properties);
  });
  const trackPageView = Effect.fn("makeTestTracking.trackPageView")(function* (
    page: TrackPageKey,
    properties?: AnyTrackPageProperties
  ) {
    yield* Ref.update(pageViews, (current) => [
      ...current,
      properties === undefined ? { page } : { page, properties },
    ]);
  });
  const service = TrackingService.of({
    trackEvent,
    trackPageView,
  });

  return {
    clear: Effect.all([Ref.set(events, []), Ref.set(pageViews, [])], {
      discard: true,
    }),
    layer: Layer.succeed(TrackingService, service),
    service,
    trackedEvents: Ref.get(events),
    trackedPageViews: Ref.get(pageViews),
  } as const;
});
