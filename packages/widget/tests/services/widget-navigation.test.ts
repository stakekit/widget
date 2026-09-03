import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema, Stream } from "effect";
import type { DataRouter } from "react-router";
import { ApplicationRouter } from "../../src/services/navigation/application-router";
import {
  toWidgetPath,
  WidgetNavigation,
  WidgetPath,
} from "../../src/services/navigation/widget-navigation";

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

        yield* navigation.push(toWidgetPath("/positions/one"), {
          scroll: "reset",
        });
        yield* navigation.replace(toWidgetPath("/positions/two"), {
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

  it("rejects route-relative application paths", () => {
    expect(() => Schema.decodeUnknownSync(WidgetPath)("positions/one")).toThrow(
      "Expected a string matching template literal parts"
    );
  });

  it.effect("normalizes router failures", () =>
    Effect.gen(function* () {
      const applicationRouterLayer = Layer.succeed(
        ApplicationRouter,
        ApplicationRouter.of({
          pathnames: Stream.never,
          router: {
            navigate: () =>
              Promise.reject(new Error("router rejected navigation")),
          } as unknown as DataRouter,
        })
      );
      const program = WidgetNavigation.use((navigation) =>
        navigation.push(toWidgetPath("/review"), { scroll: "preserve" })
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
