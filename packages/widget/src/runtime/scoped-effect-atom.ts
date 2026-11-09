import type { Effect, Scope, Stream } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as Reactivity from "effect/reactivity/Reactivity";

type ScopedAcquire<R, A, E> = (
  context: Atom.AtomContext
) => Effect.Effect<
  A,
  E,
  Scope.Scope | AtomRegistry.AtomRegistry | Reactivity.Reactivity | R
>;

export const atomToStream = <A>(
  context: Atom.AtomContext,
  atom: Atom.Atom<A>
): Stream.Stream<A> => AtomRegistry.toStream(context.registry, atom);

export const makeScopedEffectAtom = <R, ER, A, E, Value>({
  acquire,
  label,
  makeValue,
  runtime,
}: {
  readonly acquire: ScopedAcquire<R, A, E>;
  readonly label: string;
  readonly makeValue: (
    handleAtom: Atom.Atom<AsyncResult.AsyncResult<A, E | ER>>
  ) => Value;
  readonly runtime: Atom.AtomRuntime<R, ER>;
}): Atom.Atom<Value> => {
  const handleAtom = runtime
    .atom(acquire)
    .pipe(Atom.withLabel(`${label}Handle`));
  const value = makeValue(handleAtom);

  return Atom.make((context) => {
    context.mount(handleAtom);
    return value;
  }).pipe(Atom.withLabel(label));
};
