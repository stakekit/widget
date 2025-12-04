import type { Either, EitherAsync, Maybe } from "purify-ts";

export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type Override<T1, T2> = Omit<T1, keyof T2> & T2;

export type GetEitherAsyncRight<T> =
  T extends EitherAsync<unknown, infer R> ? R : never;

export type GetEitherRight<T> = T extends Either<unknown, infer R> ? R : never;

export type GetMaybeJust<T> = T extends Maybe<infer R> ? R : never;

export type Action<T extends string, D = void> = D extends void
  ? { type: T }
  : { type: T; data: D };

export type Nullable<T> = T | undefined | null;

export type KebabToCamelCase<S extends string> =
  S extends `${infer P1}-${infer P2}${infer P3}`
    ? `${P1}${Capitalize<KebabToCamelCase<`${P2}${P3}`>>}`
    : S;
