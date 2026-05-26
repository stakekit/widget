import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { config } from "../config";
import type { Networks } from "../domain/types/chains/networks";
import type { ApiClient } from "../providers/api/api-client";

export const getEnabledNetworks = ({
  apiClient,
  queryClient,
}: {
  apiClient: ApiClient;
  queryClient: QueryClient;
}) =>
  EitherAsync(() =>
    queryClient.fetchQuery({
      staleTime: Number.POSITIVE_INFINITY,
      queryKey: [config.appPrefix, "enabled-networks"],
      queryFn: async () =>
        new Set(
          (await apiClient.yield.NetworksControllerGetNetworks(undefined)).map(
            (network) => network.id as Networks
          )
        ),
    })
  ).mapLeft(() => new Error("Could not get enabled networks"));
