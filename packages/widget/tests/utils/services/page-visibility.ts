import { Duration, Effect, Layer, SubscriptionRef } from "effect";
import { Atom, type AtomRegistry } from "effect/reactivity";
import { TestClock } from "effect/testing";

import { pageVisibilityRuntime } from "../../../src/runtime/page-visibility";
import {
  PageVisibility,
  type PageVisibilityState,
} from "../../../src/services/page-visibility";

/**
 * Page visibility the test sets, as a registry initial value whose runtime
 * also runs on the test's clock, so `TestClock.adjust` drives periodic
 * refreshes.
 */
const makeTestPageVisibility = Effect.fn("makeTestPageVisibility")(function* (
  initial: PageVisibilityState
) {
  const state = yield* SubscriptionRef.make(initial);
  const testServices = yield* Effect.context<never>();
  const layer = Layer.merge(
    Layer.succeed(
      PageVisibility,
      PageVisibility.of({ changes: SubscriptionRef.changes(state) })
    ),
    Layer.succeedContext(testServices)
  );

  return {
    initialValue: Atom.initialValue(pageVisibilityRuntime.layer, layer),
    set: (next: PageVisibilityState) =>
      SubscriptionRef.set(state, next).pipe(Effect.andThen(Effect.yieldNow)),
  };
});

/** A registry initial value, as `Atom.initialValue` makes. */
type InitialValue = readonly [Atom.Atom<unknown>, unknown];

/**
 * A Resource's read count at each step of a page that is visible, hidden for
 * four refresh periods, then shown again: once mounted, one period later,
 * after the hidden periods, once shown, one second short of a period after
 * that, and a full period after it. `mount` mounts the Resource in a registry
 * seeded with the test page visibility; `readCount` counts its reads.
 */
export const readCountsAcrossHiddenPage = Effect.fn(
  "readCountsAcrossHiddenPage"
)(function* ({
  mount,
  periodSeconds,
  readCount,
}: {
  readonly mount: (pageVisibility: InitialValue) => AtomRegistry.AtomRegistry;
  readonly periodSeconds: number;
  readonly readCount: () => number;
}) {
  const visibility = yield* makeTestPageVisibility("visible");
  const registry = mount(visibility.initialValue);
  yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
  yield* Effect.yieldNow;
  const mounted = readCount();

  yield* TestClock.adjust(Duration.seconds(periodSeconds));
  const afterPeriod = readCount();

  yield* visibility.set("hidden");
  yield* TestClock.adjust(Duration.seconds(periodSeconds * 4));
  const afterHiddenPeriods = readCount();

  yield* visibility.set("visible");
  const shown = readCount();

  yield* TestClock.adjust(Duration.seconds(periodSeconds - 1));
  const almostPeriodAfterShown = readCount();
  yield* TestClock.adjust("1 second");

  return [
    mounted,
    afterPeriod,
    afterHiddenPeriods,
    shown,
    almostPeriodAfterShown,
    readCount(),
  ];
});
