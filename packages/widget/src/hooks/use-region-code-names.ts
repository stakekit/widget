import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";
import type { Nullable } from "../types/utils";

export const useRegionCodeName = (regionCode: Nullable<string>) => {
  return useQuery({
    queryKey: ["region-codes"],
    enabled: !!regionCode,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () =>
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
  });
};
