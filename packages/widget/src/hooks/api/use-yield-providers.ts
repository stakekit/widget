import type { QueryClient } from "@tanstack/react-query";
import type { YieldProviderDetails } from "../../domain/types/yields";
import type { ApiClient } from "../../providers/api/api-client";

const staleTime = 1000 * 60 * 2;
const getProviderKey = (providerId: string) => ["yield-provider", providerId];

export const fetchYieldProvider = async ({
  client,
  providerId,
  queryClient,
}: {
  client: ReturnType<ApiClient["withOptions"]>;
  providerId: string;
  queryClient: QueryClient;
}): Promise<YieldProviderDetails | undefined> => {
  try {
    return await queryClient.fetchQuery({
      queryKey: getProviderKey(providerId),
      staleTime,
      queryFn: () =>
        client.yield.ProvidersControllerGetProvider(providerId, undefined),
    });
  } catch (e) {
    console.log(e);
    return undefined;
  }
};

export const fetchYieldProviders = async ({
  client,
  providerIds,
  queryClient,
}: {
  client: ReturnType<ApiClient["withOptions"]>;
  providerIds: ReadonlyArray<string>;
  queryClient: QueryClient;
}) => {
  const providers = await Promise.all(
    [...new Set(providerIds)].map(async (providerId) => ({
      providerId,
      provider: await fetchYieldProvider({ client, providerId, queryClient }),
    }))
  );

  return new Map(
    providers.flatMap(({ provider, providerId }) =>
      provider ? [[providerId, provider]] : []
    )
  );
};
