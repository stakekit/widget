import { YieldDto } from "@stakekit/api-hooks";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";

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
      apr: number;
      address?: string;
    }>
  >(
    () =>
      integrationData.chain((val) =>
        validatorAddress
          .chain((addr) => {
            if (addr === "default") {
              return Maybe.fromNullable(val.metadata.provider).map((v) => ({
                logo: v.logoURI,
                name: v.name,
                apr: val.apy,
              }));
            }

            return List.find((v) => v.address === addr, val.validators).map(
              (v) => ({
                logo: v.image,
                name: v.name,
                apr: v.apr,
                address: v.address,
              })
            );
          })
          .altLazy(() =>
            Maybe.fromNullable(val.metadata.provider).map((v) => ({
              logo: v.logoURI,
              name: v.name,
              apr: val.apy,
            }))
          )
      ),
    [integrationData, validatorAddress]
  );
