import { Just, Maybe, Nothing } from "purify-ts";
import type { GetMaybeJust } from "../types";

Maybe.fromRecord = <T extends Record<string, Maybe<unknown>>>(
  val: T
): Maybe<{ [Key in keyof T]: GetMaybeJust<T[Key]> }> => {
  const result = {} as { [Key in keyof T]: GetMaybeJust<T[Key]> };

  for (const key in val) {
    const maybe = val[key];

    if (maybe.isJust()) {
      result[key] = maybe.extract() as GetMaybeJust<
        T[Extract<keyof T, string>]
      >;
    } else {
      return Nothing;
    }
  }

  return Just(result);
};
