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
      aprPercentage: string;
      apr: number;
      address?: string;
    }>
  >(() => {
    const def = integrationData.chain((val) =>
      Maybe.fromNullable(val.metadata.provider)
        .map((v) => ({
          logo: v.logoURI,
          name: v.name,
          aprPercentage: apyToPercentage(val.apy),
          apr: val.apy,
        }))
        .altLazy(() =>
          Maybe.of({
            logo: val.metadata.logoURI,
            name: val.metadata.name,
            aprPercentage: apyToPercentage(val.apy),
            apr: val.apy,
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
              aprPercentage: apyToPercentage(v.apr),
              address: v.address,
              apr: val.apy,
            })
          );
        })
        .altLazy(() => def)
    );
  }, [integrationData, validatorAddress]);
