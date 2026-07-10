import { useAtomValue } from "@effect/atom-react";
import { Data, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { Nullable } from "../types/utils";

class RegionCodeKey extends Data.Class<{
  readonly regionCode: string | null;
}> {}

class RegionCodeError extends Data.TaggedError("RegionCodeError")<{
  readonly cause: unknown;
}> {}

const regionCodeNameAtom = Atom.family((key: RegionCodeKey) =>
  Atom.make(() =>
    Effect.gen(function* () {
      if (!key.regionCode) return null;

      const regions = yield* Effect.tryPromise({
        try: () => import("../utils/region-iso-3166-codes"),
        catch: (cause) => new RegionCodeError({ cause }),
      });
      const region = Object.entries(regions.countries).find(
        ([code]) => code === key.regionCode
      )?.[1];

      if (!region?.subdivisionName) {
        return yield* new RegionCodeError({
          cause: new Error(`Unknown region code: ${key.regionCode}`),
        });
      }

      return region.subdivisionName;
    })
  )
);

export const useRegionCodeName = (regionCode: Nullable<string>) => {
  const result = useAtomValue(
    regionCodeNameAtom(new RegionCodeKey({ regionCode: regionCode ?? null }))
  );
  const value = result.pipe(AsyncResult.value, Option.getOrUndefined);

  return {
    data: value === null ? undefined : value,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: !!regionCode && AsyncResult.isInitial(result),
  } as const;
};
