import * as Atom from "effect/unstable/reactivity/Atom";
import type { ActivityFilter } from "../model/filters";

export const activityFilterAtom = Atom.make<ActivityFilter>("all").pipe(
  Atom.keepAlive,
  Atom.withLabel("activityFilterAtom")
);
