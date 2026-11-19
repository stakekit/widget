import { Effect } from "effect";

/**
 * Resumes once the current call stack has run. An Atom is first read in a
 * React render, and the Atom runtime runs the fibers it forks there, so an
 * Atom whose Effect reaches the host (a wallet request, a published event)
 * yields here first; otherwise a host state update it causes would land inside
 * that render.
 */
export const afterCurrentRender: Effect.Effect<void> = Effect.promise(() =>
  Promise.resolve()
);
