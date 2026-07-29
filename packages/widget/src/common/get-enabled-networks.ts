import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { config } from "../config";
import type { Networks } from "../domain/types/chains/networks";
import type { ApiClient } from "../providers/api/api-client";

export const enabledNetworksQueryKey = [config.appPrefix, "enabled-networks"];

export const getEnabledNetworksQueryFn = async ({
  apiClient,
}: {
  apiClient: ApiClient;
}) =>
  new Set(
    (await apiClient.legacy.YieldControllerGetMyNetworks(undefined)).map(
      (network) => network as Networks
    )
  );

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
      queryKey: enabledNetworksQueryKey,
      queryFn: () => getEnabledNetworksQueryFn({ apiClient }),
    })
  ).mapLeft(() => new Error("Could not get enabled networks"));
