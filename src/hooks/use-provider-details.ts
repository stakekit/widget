import { YieldDto } from "@stakekit/api-hooks";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import { apyToPercentage } from "../utils";

export const useProviderDetails = ({
  integrationData,
  validatorAddress,
}: {
  integrationData: Maybe<YieldDto>;
  validatorAddress: Maybe<"default" | (string & {})>;
}) =>
  useMemo<
    Maybe<{
      logo: string;
      name: string;
      apr: string;
      address?: string;
    }>
  >(() => {
    const def = integrationData.chain((val) =>
      Maybe.fromNullable(val.metadata.provider)
        .map((v) => ({
          logo: v.logoURI,
          name: v.name,
          apr: apyToPercentage(val.apy),
        }))
        .altLazy(() =>
          Maybe.of({
            logo: val.metadata.logoURI,
            name: val.metadata.name,
            apr: apyToPercentage(val.apy),
          })
        )
    );

    return integrationData.chain((val) =>
      validatorAddress
        .chain((addr) => {
          if (addr === "default") {
            return def;
          }

          return List.find((v) => v.address === addr, val.validators).map(
            (v) => ({
              logo: v.image,
              name: v.name,
              apr: apyToPercentage(v.apr),
              address: v.address,
            })
          );
        })
        .altLazy(() => def)
    );
  }, [integrationData, validatorAddress]);
