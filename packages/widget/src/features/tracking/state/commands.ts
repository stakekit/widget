import { Effect } from "effect";
import { appRuntime } from "../../../app/runtime";
import { TrackingService } from "../../../services/tracking/tracking-service";
import type {
  Properties,
  TrackEventKey,
  TrackPageKey,
} from "../../../services/tracking/types";

type TrackEventCommand = {
  readonly event: TrackEventKey;
  readonly properties?: Properties;
};

type TrackPageViewCommand = {
  readonly page: TrackPageKey;
  readonly properties?: Properties;
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
