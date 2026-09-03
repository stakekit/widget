import { type Cause, Effect, type Scope, Stream } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import type * as Reactivity from "effect/unstable/reactivity/Reactivity";

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

export const makeScopedEffectStateAtom = <
  R,
  ER,
  A,
  E,
  State,
  StateError,
  Value,
>({
  acquire,
  getStates,
  label,
  makeValue,
  runtime,
}: {
  readonly acquire: ScopedAcquire<R, A, E>;
  readonly getStates: (handle: A) => Stream.Stream<State, StateError>;
  readonly label: string;
  readonly makeValue: (atoms: {
    readonly handleAtom: Atom.Atom<AsyncResult.AsyncResult<A, E | ER>>;
    readonly stateAtom: Atom.Atom<
      AsyncResult.AsyncResult<
        State,
        Cause.NoSuchElementError | E | ER | StateError
      >
    >;
  }) => Value;
  readonly runtime: Atom.AtomRuntime<R, ER>;
}): Atom.Atom<Value> => {
  const handleAtom = runtime
    .atom(acquire)
    .pipe(Atom.withLabel(`${label}Handle`));
  const stateAtom = runtime
    .atom((context) =>
      Stream.unwrap(
        context
          .result(handleAtom)
          .pipe(Effect.map((handle) => getStates(handle)))
      )
    )
    .pipe(Atom.withLabel(`${label}State`));
  const value = makeValue({ handleAtom, stateAtom });

  return Atom.make((context) => {
    context.mount(handleAtom);
    context.mount(stateAtom);
    return value;
  }).pipe(Atom.withLabel(label));
};
