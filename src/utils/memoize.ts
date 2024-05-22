const cachedResSymbol = Symbol("cachedRes");

type CacheMap<T> = Map<unknown, { cachedRes: T } | CacheMap<T>>;

export const memoize = <Args extends unknown[], Res>(
  fn: (...args: Args) => Res
) => {
  const cache: CacheMap<ReturnType<typeof fn>> = new Map();

  type F = typeof fn;

  const memoFn = (...args: Parameters<F>): ReturnType<F> => {
    let currentCacheMap = cache;

    for (const arg of args) {
      if (!currentCacheMap.has(arg)) {
        const newMap = new Map();
        currentCacheMap.set(arg, newMap);
        currentCacheMap = newMap;
      } else {
        currentCacheMap = currentCacheMap.get(arg) as CacheMap<ReturnType<F>>;
      }
    }

    if (currentCacheMap.has(cachedResSymbol)) {
      return (
        currentCacheMap.get(cachedResSymbol) as { cachedRes: ReturnType<F> }
      ).cachedRes;
    }

    const res = fn(...args);

    currentCacheMap.set(cachedResSymbol, { cachedRes: res });

    return res;
  };

  return memoFn;
};
