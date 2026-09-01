import { Effect, Layer, Ref } from "effect";
import { TrackingService } from "../../../src/services/tracking/tracking-service";
import type {
  Properties,
  TrackEventKey,
  TrackPageKey,
} from "../../../src/services/tracking/types";

export type TrackedEvent = Readonly<{
  readonly event: TrackEventKey;
  readonly properties?: Properties;
}>;

export type TrackedPageView = Readonly<{
  readonly page: TrackPageKey;
  readonly properties?: Properties;
}>;

export const makeTestTracking = Effect.fn("makeTestTracking")(function* () {
  const events = yield* Ref.make<ReadonlyArray<TrackedEvent>>([]);
  const pageViews = yield* Ref.make<ReadonlyArray<TrackedPageView>>([]);
  const service = TrackingService.of({
    trackEvent: (event, properties) =>
      Ref.update(events, (current) => [...current, { event, properties }]),
    trackPageView: (page, properties) =>
      Ref.update(pageViews, (current) => [...current, { page, properties }]),
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
