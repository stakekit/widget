import { DefaultOptions, QueryClient } from "@tanstack/react-query";
import { config } from "../config";
import { isAxiosError, shouldRetryRequest } from "../api/utils";

export const defaultQueryClientConfiguration: DefaultOptions = {
  queries: {
    cacheTime: config.queryClient.cacheTime,
    staleTime: config.queryClient.staleTime,
    retry: (failureCount, error) => {
      if (isAxiosError(error)) {
        return !!(shouldRetryRequest(error) && failureCount < 2);
      }

      return false;
    },
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: (failureCount, error) => {
      if (isAxiosError(error)) {
        return !!(shouldRetryRequest(error) && failureCount < 2);
      }

      return false;
    },
  },
};

export const queryClient = new QueryClient({
  defaultOptions: defaultQueryClientConfiguration,
});
