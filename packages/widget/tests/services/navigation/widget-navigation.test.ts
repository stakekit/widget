import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import type { DataRouter } from "react-router";

import { ApplicationRouter } from "../../../src/services/navigation/application-router";
import { makeScrollReset } from "../../../src/services/navigation/scroll-reset";
import { WidgetNavigation } from "../../../src/services/navigation/widget-navigation";
import { widgetRoutes } from "../../../src/services/navigation/widget-routes";

/**
 * Runs `program` against a real memory router, with `window.scrollTo`
 * recorded by `scrollToTop`.
 */
const withRouter = <A, E>(
  program: (
    scrollToTop: ReturnType<typeof vi.fn>
  ) => Effect.Effect<A, E, ApplicationRouter | WidgetNavigation>
) =>
  Effect.gen(function* () {
    const scrollToTop = vi.fn();
    vi.stubGlobal("window", { scrollTo: scrollToTop });
    const applicationRouterLayer = ApplicationRouter.layer([
      { path: "*", Component: () => null },
    ]);
    try {
      return yield* program(scrollToTop).pipe(
        Effect.provide(
          Layer.mergeAll(
            applicationRouterLayer,
            WidgetNavigation.layer().pipe(Layer.provide(applicationRouterLayer))
          )
        )
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

/** Reports the current location's page as committed, as the Layouts do. */
const commitCurrentPage = Effect.gen(function* () {
  const { router, scrollReset } = yield* ApplicationRouter;
  scrollReset.pageCommitted(router.state.location.key);
});

/** Blocks the next navigation, as the Leave Confirmation does. */
const blockNextNavigation = Effect.gen(function* () {
  const { router } = yield* ApplicationRouter;
  router.getBlocker("leave", () => true);
  return {
    leave: () => router.state.blockers.get("leave")?.proceed?.(),
    stay: () => {
      router.state.blockers.get("leave")?.reset?.();
      router.deleteBlocker("leave");
    },
  };
});

describe("WidgetNavigation", () => {
  it.effect(
    "resets the scroll when the next page commits, unless preserved",
    () =>
      withRouter((scrollToTop) =>
        Effect.gen(function* () {
          const { router, scrollReset } = yield* ApplicationRouter;
          const navigation = yield* WidgetNavigation;

          const earn = router.state.location.key;
          yield* navigation.push(widgetRoutes.positions.build());
          // The page being left renders again; the scroll waits for the next.
          scrollReset.pageCommitted(earn);
          expect(scrollToTop).not.toHaveBeenCalled();
          yield* commitCurrentPage;
          expect(scrollToTop).toHaveBeenCalledTimes(1);

          yield* navigation.replace(widgetRoutes.activity.build(), {
            scroll: "preserve",
          });
          yield* commitCurrentPage;
          expect(scrollToTop).toHaveBeenCalledTimes(1);

          yield* navigation.back();
          yield* commitCurrentPage;
          expect(scrollToTop).toHaveBeenCalledTimes(2);
          expect(router.state.location.pathname).toBe("/");
        })
      )
  );

  it.effect(
    "resets the scroll of a blocked navigation the user leaves on",
    () =>
      withRouter((scrollToTop) =>
        Effect.gen(function* () {
          const { router } = yield* ApplicationRouter;
          const navigation = yield* WidgetNavigation;
          const blocker = yield* blockNextNavigation;

          yield* navigation.push(widgetRoutes.positions.build());
          yield* commitCurrentPage;
          expect(scrollToTop).not.toHaveBeenCalled();

          blocker.leave();
          yield* Effect.promise(() =>
            vi.waitFor(() =>
              expect(router.state.location.pathname).toBe("/positions")
            )
          );
          yield* commitCurrentPage;
          expect(scrollToTop).toHaveBeenCalledTimes(1);
        })
      )
  );

  it.effect(
    "drops the scroll reset of a blocked navigation the user stays on",
    () =>
      withRouter((scrollToTop) =>
        Effect.gen(function* () {
          const navigation = yield* WidgetNavigation;
          const blocker = yield* blockNextNavigation;

          yield* navigation.push(widgetRoutes.positions.build());
          blocker.stay();
          // A later navigation that keeps the scroll must not inherit the reset.
          yield* navigation.push(widgetRoutes.activity.build(), {
            scroll: "preserve",
          });
          yield* commitCurrentPage;
          expect(scrollToTop).not.toHaveBeenCalled();
        })
      )
  );

  it.effect("normalizes router failures", () =>
    Effect.gen(function* () {
      const applicationRouterLayer = Layer.succeed(
        ApplicationRouter,
        ApplicationRouter.of({
          locations: Stream.never,
          router: {
            navigate: () =>
              Promise.reject(new Error("router rejected navigation")),
            state: { blockers: new Map(), location: { key: "default" } },
          } as unknown as DataRouter,
          scrollReset: makeScrollReset(),
        })
      );
      const program = WidgetNavigation.use((navigation) =>
        navigation.push(widgetRoutes.earn.build(), { scroll: "preserve" })
      ).pipe(
        Effect.provide(
          WidgetNavigation.layer().pipe(Layer.provide(applicationRouterLayer))
        ),
        Effect.flip
      );

      expect((yield* program)._tag).toBe("WidgetNavigationError");
    })
  );
});
