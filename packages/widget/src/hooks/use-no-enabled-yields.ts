import { useQuery } from "@tanstack/react-query";
import {
  enabledNetworksQueryKey,
  getEnabledNetworksQueryFn,
} from "../common/get-enabled-networks";
import { useApiClient } from "../providers/api/api-client-provider";

export const useNoEnabledYields = () => {
  const apiClient = useApiClient();

  const { data, isSuccess } = useQuery({
    staleTime: Number.POSITIVE_INFINITY,
    queryKey: enabledNetworksQueryKey,
    queryFn: () => getEnabledNetworksQueryFn({ apiClient }),
  });

  return isSuccess && data.size === 0;
};
