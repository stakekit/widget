import { Data, Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

export class RegionCodeKey extends Data.Class<{
  readonly regionCode: string | null;
}> {}

class RegionCodeError extends Data.TaggedError("RegionCodeError")<{
  readonly cause: unknown;
}> {}

const regionCodeNameResultAtom = Atom.family((key: RegionCodeKey) =>
  Atom.make(() =>
    Effect.gen(function* () {
      if (!key.regionCode) return null;

      const regions = yield* Effect.tryPromise({
        try: () => import("../../../shared/data/region-iso-3166-codes"),
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

/** The region's subdivision name; undefined while loading or unknown. */
export const regionCodeNameAtom = Atom.family((key: RegionCodeKey) =>
  Atom.make(
    (get) =>
      get(regionCodeNameResultAtom(key)).pipe(
        AsyncResult.value,
        Option.getOrUndefined
      ) ?? undefined
  ).pipe(Atom.withLabel("regionCodeNameAtom"))
);
