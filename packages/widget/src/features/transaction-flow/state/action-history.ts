import * as Atom from "effect/unstable/reactivity/Atom";

export const actionHistoryTimestampAtom = Atom.make<number | null>(null).pipe(
  Atom.withLabel("actionHistoryTimestampAtom")
);

export const markActionHistoryChanged = (timestamp = Date.now()) => timestamp;

export const resetActionHistory = () => null;
