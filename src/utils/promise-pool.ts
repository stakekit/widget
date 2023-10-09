type TupleAwaitedVals<T extends readonly (() => Promise<unknown>)[]> = {
  [Key in keyof T]: Awaited<ReturnType<T[Key]>>;
};

export const promisePool = <T extends readonly (() => Promise<unknown>)[] | []>(
  fns: T,
  n: number
) => {
  return () => {
    let current = 0;

    const results = new Array(fns.length);

    const thenCb = (res: unknown, i: number): Promise<unknown> | void => {
      results[i] = res;

      if (current < fns.length - 1) {
        const i = current++;
        return fns[i]().then((res) => thenCb(res, i));
      }
    };

    return Promise.all(
      Array.from({ length: Math.min(n, fns.length) }).map(() => {
        const i = current++;
        return fns[i]().then((res) => thenCb(res, i));
      })
    ).then(() => results as TupleAwaitedVals<T>);
  };
};

// const pp = promisePool(
//   yieldIds.map(
//     (y) => () =>
//       withRequestErrorRetry({
//         fn: () =>
//           yieldYieldOpportunity(
//             y,
//             { ledgerWalletAPICompatible: isLedgerLive },
//             signal
//           ),
//       })
//         .mapLeft(() => new Error("Unknown error"))
//         .run()
//   ),
//   5
// );
