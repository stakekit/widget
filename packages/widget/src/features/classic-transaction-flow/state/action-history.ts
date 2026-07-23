import * as Atom from "effect/unstable/reactivity/Atom";

export const actionHistoryRevisionAtom = Atom.make(0).pipe(
  Atom.withLabel("actionHistoryRevisionAtom")
);

export const incrementActionHistoryRevision = (revision: number) =>
  revision + 1;

export const resetActionHistoryRevision = () => 0;
