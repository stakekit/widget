import { Either, EitherAsync } from "purify-ts";

export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type Nullable<T> = T | null | undefined;

export type Override<T1, T2> = Omit<T1, keyof T2> & T2;

export type GetEitherAsyncRight<T> = T extends EitherAsync<any, infer R>
  ? R
  : never;

export type GetEitherAsyncLeft<T> = T extends EitherAsync<infer E, any>
  ? E
  : never;

export type GetEitherRight<T> = T extends Either<any, infer R> ? R : never;

export type GetEitherLeft<T> = T extends Either<infer E, any> ? E : never;
