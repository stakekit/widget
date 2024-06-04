import { EitherAsync, Right } from "purify-ts";
import type { GetEitherAsyncRight } from "../types";

type TupleRightVals<T extends readonly (() => EitherAsync<Error, unknown>)[]> =
  { [Key in keyof T]: GetEitherAsyncRight<ReturnType<T[Key]>> };

export const eitherAsyncPool = <
  T extends readonly (() => EitherAsync<Error, unknown>)[] | [],
>(
  fns: T,
  n: number
) => {
  return () => {
    let current = 0;

    const results = new Array(fns.length);

    const thenCb = (res: unknown, i: number): EitherAsync<Error, null> => {
      results[i] = res;

      if (current < fns.length) {
        const i = current++;
        return fns[i]().chain((res) => thenCb(res, i));
      }

      return EitherAsync.liftEither(Right(null));
    };

    return EitherAsync.all(
      Array.from({ length: Math.min(n, fns.length) }).map(() => {
        const i = current++;
        return fns[i]().chain((res) => thenCb(res, i));
      })
    ).map(() => results as TupleRightVals<T>);
  };
};
