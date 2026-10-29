import { Effect } from "effect";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { TrackingService } from "../../../services/tracking/tracking-service";
import type {
  AnyTrackEventProperties,
  AnyTrackPageProperties,
  TrackEventKey,
  TrackPageKey,
} from "../../../services/tracking/types";

/**
 * Commands carry any event's properties; `useTrackEvent` and `useTrackPage`
 * check them against the event before dispatching.
 */
type TrackEventCommand = {
  readonly event: TrackEventKey;
  readonly properties?: AnyTrackEventProperties | undefined;
};

type TrackPageViewCommand = {
  readonly page: TrackPageKey;
  readonly properties?: AnyTrackPageProperties | undefined;
};

export const trackEventAtom = appRuntime.fn((command: TrackEventCommand) =>
  Effect.gen(function* () {
    const tracking = yield* TrackingService;
    yield* tracking.trackEvent(command.event, command.properties);
  })
);

export const trackPageViewAtom = appRuntime.fn(
  (command: TrackPageViewCommand) =>
    Effect.gen(function* () {
      const tracking = yield* TrackingService;
      yield* tracking.trackPageView(command.page, command.properties);
    })
);
