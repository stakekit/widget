import { Predicate, Record } from "effect";

const combineNested = (left: unknown, right: unknown): unknown => {
  if (right === undefined) {
    return left;
  }

  if (Predicate.isObject(left) && Predicate.isObject(right)) {
    return mergeDeep(left, right);
  }

  return right;
};

export const mergeDeep = <A>(
  base: A,
  ...overlays: ReadonlyArray<unknown>
): A => {
  let merged: Record<string, unknown> = Record.empty();

  for (const source of [base, ...overlays]) {
    if (!Predicate.isObject(source)) {
      continue;
    }

    merged = Record.union(merged, source, combineNested);
  }

  return merged as A;
};
