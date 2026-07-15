import { Equal, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

export const selectAtom = <A, B>(
  source: Atom.Atom<A>,
  select: (value: A) => B
): Atom.Atom<B> =>
  Atom.make((get) => {
    const next = select(get(source));
    const previous = get.self<B>();

    return Option.isSome(previous) && Equal.equals(previous.value, next)
      ? previous.value
      : next;
  });
