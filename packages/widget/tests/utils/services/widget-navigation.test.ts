import { describe, expect, it } from "@effect/vitest";
import { Effect, Ref } from "effect";
import {
  toWidgetPath,
  type WidgetNavigationCommand,
  WidgetNavigationError,
} from "../../../src/services/navigation/widget-navigation";
import { makeTestNavigation } from "./widget-navigation";

describe("makeTestNavigation", () => {
  it.effect(
    "records every navigation command and can clear the recording",
    () =>
      Effect.gen(function* () {
        const navigation = yield* makeTestNavigation();

        yield* navigation.service.push(toWidgetPath("/earn"));
        yield* navigation.service.replace(toWidgetPath("/activity"), {
          scroll: "preserve",
        });
        yield* navigation.service.back({ state: { source: "test" } });

        expect(yield* navigation.commands).toEqual([
          { _tag: "Push", path: "/earn" },
          { _tag: "Replace", path: "/activity", scroll: "preserve" },
          { _tag: "Back", state: { source: "test" } },
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
        navigation.service.push(toWidgetPath("/earn"))
      );

      expect(error).toBe(failure);
      expect(yield* Ref.get(received)).toEqual({
        _tag: "Push",
        path: "/earn",
      });
    })
  );
});
