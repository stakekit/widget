import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { makeTestTracking } from "./tracking-service";

describe("makeTestTracking", () => {
  it.effect("records events and page views as readonly snapshots", () =>
    Effect.gen(function* () {
      const tracking = yield* makeTestTracking();

      yield* tracking.service.trackEvent("tabClicked", { tab: "earn" });
      yield* tracking.service.trackPageView("earn", { source: "test" });

      expect(yield* tracking.trackedEvents).toEqual([
        { event: "tabClicked", properties: { tab: "earn" } },
      ]);
      expect(yield* tracking.trackedPageViews).toEqual([
        { page: "earn", properties: { source: "test" } },
      ]);

      yield* tracking.clear;

      expect(yield* tracking.trackedEvents).toEqual([]);
      expect(yield* tracking.trackedPageViews).toEqual([]);
    })
  );
});
