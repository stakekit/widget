import type { useYieldGetMyNetworksHook } from "@stakekit/api-hooks";
import { EitherAsync } from "purify-ts";
import { config } from "../../config";
import type { QueryClient } from "@tanstack/react-query";
import type { Networks } from "@stakekit/common";

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
