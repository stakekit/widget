import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import type { DataRouter } from "react-router";
import { ApplicationRouter } from "../../../src/services/navigation/application-router";
import { WidgetNavigation } from "../../../src/services/navigation/widget-navigation";
import { widgetRoutes } from "../../../src/services/navigation/widget-routes";

describe("WidgetNavigation", () => {
  it.effect("executes absolute push, replace, back, and scroll decisions", () =>
    Effect.gen(function* () {
      const scrollToTop = vi.fn();
      vi.stubGlobal("window", { scrollTo: scrollToTop });
      const applicationRouterLayer = ApplicationRouter.layer([
        { path: "*", Component: () => null },
      ]);
      const program = Effect.gen(function* () {
        const { router } = yield* ApplicationRouter;
        const navigation = yield* WidgetNavigation;

        yield* navigation.push(widgetRoutes.positions.build(), {
          scroll: "reset",
        });
        yield* navigation.replace(widgetRoutes.activity.build(), {
          scroll: "preserve",
        });
        yield* navigation.back({ scroll: "reset" });

        return router.state.location.pathname;
      });

      try {
        const path = yield* program.pipe(
          Effect.provide(
            Layer.mergeAll(
              applicationRouterLayer,
              WidgetNavigation.layer().pipe(
                Layer.provide(applicationRouterLayer)
              )
            )
          )
        );

        expect(path).toBe("/");
        expect(scrollToTop).toHaveBeenCalledTimes(2);
      } finally {
        vi.unstubAllGlobals();
      }
    })
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
          } as unknown as DataRouter,
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
