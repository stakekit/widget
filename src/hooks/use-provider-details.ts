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
  useMemo(
    () =>
      integrationData.chain((val) =>
        validatorAddress
          .chain((addr) => {
            if (addr === "default") {
              return Maybe.fromNullable(val.metadata.provider).map((v) => ({
                logo: v.logoURI,
                name: v.name,
              }));
            }

            return List.find((v) => v.address === addr, val.validators).map(
              (v) => ({ logo: v.image, name: v.name })
            );
          })
          .altLazy(() =>
            Maybe.fromNullable(val.metadata.provider).map((v) => ({
              logo: v.logoURI,
              name: v.name,
            }))
          )
      ),
    [integrationData, validatorAddress]
  );
