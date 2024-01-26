import { DefaultOptions, QueryClient } from "@tanstack/react-query";
import { config } from "../config";
import { shouldRetryRequest } from "../common/utils";
import { isAxiosError } from "axios";

export const defaultQueryClientConfiguration: DefaultOptions = {
  queries: {
    gcTime: config.queryClient.cacheTime,
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
