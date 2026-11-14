import { Effect, Schedule, Stream } from "effect";

import { connectPickerSessions } from "../../../src/features/wallet/model/connect-picker";
import { describe, expect, it } from "../../utils/test-extend";

/**
 * What the picker shows over a sequence of opens and closes, each step
 * coming after the last session has shown its rows, as a user's would.
 */
const statesOver = (
  steps: ReadonlyArray<boolean>,
  session: (open: number) => ReadonlyArray<string>
) =>
  Effect.gen(function* () {
    const opens = { count: 0 };
    return yield* Stream.runCollect(
      connectPickerSessions(
        Stream.fromIterable(steps).pipe(
          Stream.schedule(Schedule.spaced("20 millis"))
        ),
        Stream.suspend(() => {
          opens.count += 1;
          return Stream.make(session(opens.count));
        })
      )
    );
  });

describe("connectPickerSessions", () => {
  it.live("closes with the rows it showed", () =>
    Effect.gen(function* () {
      const states = yield* statesOver([false, true, false], () => [
        "metamask",
      ]);

      expect(states).toEqual([
        { open: false, rows: [] },
        { open: true, rows: [] },
        { open: true, rows: ["metamask"] },
        // The dialog animates away with its list.
        { open: false, rows: ["metamask"] },
      ]);
    })
  );

  it.live("opens again without the last session's rows", () =>
    Effect.gen(function* () {
      const states = yield* statesOver([true, false, true], (open) =>
        open === 1 ? ["catalogue-first"] : ["installed-first"]
      );

      // The reopened dialog shows no row the new session would then move.
      expect(states).toEqual([
        { open: true, rows: [] },
        { open: true, rows: ["catalogue-first"] },
        { open: false, rows: ["catalogue-first"] },
        { open: true, rows: [] },
        { open: true, rows: ["installed-first"] },
      ]);
    })
  );
});
