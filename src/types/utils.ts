import { Either, EitherAsync, Maybe } from "purify-ts";

export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type Override<T1, T2> = Omit<T1, keyof T2> & T2;

export type GetEitherAsyncRight<T> =
  T extends EitherAsync<any, infer R> ? R : never;

export type GetEitherAsyncLeft<T> =
  T extends EitherAsync<infer E, any> ? E : never;

export type GetEitherRight<T> = T extends Either<any, infer R> ? R : never;

export type GetMaybeJust<T> = T extends Maybe<infer R> ? R : never;

export type Action<T extends string, D = void> = D extends void
  ? { type: T }
  : { type: T; data: D };
