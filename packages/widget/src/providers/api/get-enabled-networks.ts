import { yieldGetMyNetworks } from "@stakekit/api-hooks";
import type { Networks } from "@stakekit/common";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { config } from "../../config";

export const getEnabledNetworks = ({
  queryClient,
}: {
  queryClient: QueryClient;
}) =>
  EitherAsync(() =>
    queryClient.fetchQuery({
      staleTime: Number.POSITIVE_INFINITY,
      queryKey: [config.appPrefix, "enabled-networks"],
      queryFn: async () =>
        (
          await EitherAsync(() => yieldGetMyNetworks()).map(
            (v) => new Set(v as Networks[])
          )
        ).unsafeCoerce(),
    })
  ).mapLeft(() => new Error("Could not get enabled networks"));
