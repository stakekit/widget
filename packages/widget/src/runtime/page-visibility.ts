import { type Duration, Effect, Stream } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

import { PageVisibility } from "../services/page-visibility";

/**
 * Its own runtime, apart from the Application Runtime, so a test replaces page
 * visibility and the clock periodic refreshes run on without rebuilding the
 * Application Runtime.
 */
export const pageVisibilityRuntime = Atom.runtime(PageVisibility.layer);

const awaitVisiblePage = PageVisibility.use((visibility) =>
  visibility.changes.pipe(
    Stream.filter((state) => state === "visible"),
    Stream.take(1),
    Stream.runDrain
  )
);

/**
 * Refreshes a Resource every `period` while it is mounted and the page is
 * visible. A period that ends while the page is hidden refreshes it once when
 * the page is shown again, and the schedule resumes from there.
 */
export const withVisibleRefresh =
  (period: Duration.Input) =>
  <A, E>(
    self: Atom.Atom<AsyncResult.AsyncResult<A, E>>
  ): Atom.Atom<AsyncResult.AsyncResult<A, E>> => {
    const refreshScheduleAtom = pageVisibilityRuntime
      .atom((get) =>
        Effect.sleep(period).pipe(
          Effect.andThen(awaitVisiblePage),
          Effect.andThen(Effect.sync(() => get.refresh(self))),
          Effect.forever
        )
      )
      .pipe(Atom.withLabel("refreshScheduleAtom"));

    return Atom.transform(
      self,
      (get) => {
        get.mount(refreshScheduleAtom);
        return get(self);
      },
      { initialValueTarget: self }
    );
  };
