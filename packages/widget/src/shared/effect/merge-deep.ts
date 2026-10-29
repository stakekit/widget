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

/**
 * Merges plain objects key by key, later sources winning; nested plain objects
 * merge recursively and `undefined` never overwrites. Non-object sources are
 * skipped. The result is untyped: callers read it through their own decoder.
 */
export const mergeDeep = (
  ...sources: ReadonlyArray<unknown>
): Record<string, unknown> => {
  let merged: Record<string, unknown> = Record.empty();

  for (const source of sources) {
    if (!Predicate.isObject(source)) {
      continue;
    }

    merged = Record.union(merged, source, combineNested);
  }

  return merged;
};
