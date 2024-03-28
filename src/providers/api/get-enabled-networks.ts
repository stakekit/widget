import { Networks, useYieldGetMyNetworksHook } from "@stakekit/api-hooks";
import { EitherAsync } from "purify-ts";
import { config } from "../../config";
import { QueryClient } from "@tanstack/react-query";

export const getEnabledNetworks = ({
  queryClient,
  yieldGetMyNetworks,
}: {
  queryClient: QueryClient;
  yieldGetMyNetworks: ReturnType<typeof useYieldGetMyNetworksHook>;
}) =>
  EitherAsync(() =>
    queryClient.fetchQuery({
      staleTime: Infinity,
      queryKey: [config.appPrefix, "enabled-networks"],
      queryFn: async () =>
        (
          await EitherAsync(() => yieldGetMyNetworks()).map(
            (v) => new Set(v as Networks[])
          )
        ).unsafeCoerce(),
    })
  ).mapLeft(() => new Error("Could not get enabled networks"));
