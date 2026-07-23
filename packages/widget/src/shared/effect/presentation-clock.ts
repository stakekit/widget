import { DateTime, Schedule, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

type PresentationTime = {
  readonly now: DateTime.Utc;
  readonly timeZone: DateTime.TimeZone;
};

const presentationClockResourceAtom = Atom.make(
  Stream.fromEffectSchedule(DateTime.now, Schedule.spaced("1 minute")).pipe(
    Stream.map(
      (now): PresentationTime => ({
        now,
        timeZone: DateTime.zoneMakeLocal(),
      })
    )
  )
).pipe(Atom.withLabel("presentationClockResourceAtom"));

export const presentationClockAtom = Atom.make((get) =>
  AsyncResult.getOrElse(get(presentationClockResourceAtom), () => null)
).pipe(Atom.withLabel("presentationClockAtom"));
