import { Cause, Effect } from "effect";
import { HttpResponse, http } from "msw";

import { expect, it } from "./test-extend.dom.ts";

const fixtureUrl = "https://fixture.test/effect-vitest";

it.effect.skipIf(false)(
  "preserves the fixture through test modifiers",
  ({ worker }) =>
    Effect.sync(() => {
      expect(worker).toBeDefined();
    })
);

it.effect.fails(
  "cleans up fixtures after an expected Effect failure",
  ({ worker }) =>
    Effect.sync(() => {
      worker.use(
        http.get(fixtureUrl, () => HttpResponse.text("expected failure"))
      );
    }).pipe(
      Effect.andThen(Effect.fail(new Cause.UnknownError("expected failure")))
    )
);

it.effect("resets MSW handlers after each Effect test", () =>
  Effect.gen(function* () {
    const response = yield* Effect.promise(() => fetch(fixtureUrl));

    expect(response.status).toBe(500);
  })
);
