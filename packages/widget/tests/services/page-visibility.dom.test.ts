import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Stream } from "effect";
import { afterEach } from "vitest";

import { PageVisibility } from "../../src/services/page-visibility";

const setDocumentVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("PageVisibility", () => {
  afterEach(() => {
    Reflect.deleteProperty(document, "visibilityState");
  });

  it.effect("reports the document's visibility now, then each change", () =>
    Effect.gen(function* () {
      setDocumentVisibility("hidden");
      const visibility = yield* PageVisibility;
      const states = yield* visibility.changes.pipe(
        Stream.take(3),
        Stream.runCollect,
        Effect.forkChild({ startImmediately: true })
      );
      yield* Effect.yieldNow;
      setDocumentVisibility("visible");
      yield* Effect.yieldNow;
      setDocumentVisibility("hidden");

      expect(yield* Fiber.join(states)).toEqual([
        "hidden",
        "visible",
        "hidden",
      ]);
    }).pipe(Effect.provide(PageVisibility.layer))
  );
});
