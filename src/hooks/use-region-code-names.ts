import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";

export const useRegionCodeName = (regionCode?: string) => {
  return useQuery(
    ["region-codes"],
    async () =>
      (
        await EitherAsync.liftEither(
          Maybe.fromNullable(regionCode).toEither(
            new Error("missing regionCode")
          )
        ).chain((region) =>
          EitherAsync(() => import("../utils/region-iso-3166-codes"))
            .mapLeft(() => new Error("Failed to load region-iso-3166-codes"))
            .chain((val) =>
              EitherAsync.liftEither(
                Maybe.fromNullable(
                  val.countries[region as keyof typeof val.countries]
                    .subdivisionName
                ).toEither(new Error("region not found"))
              )
            )
        )
      ).unsafeCoerce(),
    { enabled: !!regionCode, staleTime: Infinity }
  );
};
