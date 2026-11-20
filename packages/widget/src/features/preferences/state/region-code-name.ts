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

      const { countries } = yield* Effect.tryPromise({
        try: () => import("../model/region-iso-3166-codes"),
        catch: (cause) => new RegionCodeError({ cause }),
      });
      const regions: Readonly<
        Record<string, { readonly subdivisionName: string }>
      > = countries;
      const region = Object.hasOwn(regions, key.regionCode)
        ? regions[key.regionCode]
        : undefined;

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
