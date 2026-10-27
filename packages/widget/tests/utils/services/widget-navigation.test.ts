import { describe, expect, it } from "@effect/vitest";
import { Effect, Ref } from "effect";
import {
  type WidgetNavigationCommand,
  WidgetNavigationError,
} from "../../../src/services/navigation/widget-navigation";
import { widgetRoutes } from "../../../src/services/navigation/widget-routes";
import { makeTestNavigation } from "./widget-navigation";

describe("makeTestNavigation", () => {
  it.effect(
    "records every navigation command and can clear the recording",
    () =>
      Effect.gen(function* () {
        const navigation = yield* makeTestNavigation();

        yield* navigation.service.push(widgetRoutes.earn.build());
        yield* navigation.service.replace(widgetRoutes.activity.build(), {
          scroll: "preserve",
        });
        yield* navigation.service.back({ scroll: "preserve" });

        expect(yield* navigation.commands).toEqual([
          { _tag: "Push", to: "/" },
          { _tag: "Replace", scroll: "preserve", to: "/activity" },
          { _tag: "Back", scroll: "preserve" },
        ]);

        yield* navigation.clear;
        expect(yield* navigation.commands).toEqual([]);
      })
  );

  it.effect("delegates configured commands and preserves failures", () =>
    Effect.gen(function* () {
      const received = yield* Ref.make<WidgetNavigationCommand | null>(null);
      const failure = new WidgetNavigationError({ cause: "blocked" });
      const navigation = yield* makeTestNavigation({
        execute: (command) =>
          Ref.set(received, command).pipe(Effect.andThen(Effect.fail(failure))),
      });

      const error = yield* Effect.flip(
        navigation.service.push(widgetRoutes.earn.build())
      );

      expect(error).toBe(failure);
      expect(yield* Ref.get(received)).toEqual({
        _tag: "Push",
        to: "/",
      });
    })
  );
});
