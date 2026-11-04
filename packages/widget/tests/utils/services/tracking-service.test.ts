import { describe, expect, it } from "@effect/vitest";
import { Effect, Ref } from "effect";
import { makeTestTracking } from "./tracking-service";

describe("makeTestTracking", () => {
  it.effect("records events and page views as readonly snapshots", () =>
    Effect.gen(function* () {
      const tracking = yield* makeTestTracking();

      yield* tracking.service.trackEvent("tabClicked", { selected: "earn" });
      yield* tracking.service.trackPageView("positionDetails", {
        yield: "Test yield",
      });

      expect(yield* tracking.trackedEvents).toEqual([
        { event: "tabClicked", properties: { selected: "earn" } },
      ]);
      expect(yield* tracking.trackedPageViews).toEqual([
        { page: "positionDetails", properties: { yield: "Test yield" } },
      ]);

      yield* tracking.clear;

      expect(yield* tracking.trackedEvents).toEqual([]);
      expect(yield* tracking.trackedPageViews).toEqual([]);
    })
  );

  it.effect("records events before delegating configured behavior", () =>
    Effect.gen(function* () {
      const delegatedCount = yield* Ref.make(0);
      const tracking = yield* makeTestTracking({
        trackEvent: () => Ref.update(delegatedCount, (count) => count + 1),
      });

      yield* tracking.service.trackEvent("tabClicked", { selected: "earn" });

      expect(yield* Ref.get(delegatedCount)).toBe(1);
      expect(yield* tracking.trackedEvents).toEqual([
        { event: "tabClicked", properties: { selected: "earn" } },
      ]);
    })
  );
});
