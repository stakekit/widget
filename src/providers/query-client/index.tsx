import { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { shouldRetryRequest } from "../../common/utils";
import { config } from "../../config";

const getQueryClient = () =>
  new QueryClient({
    defaultOptions: {
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
    },
  });

const Context = createContext<QueryClient | undefined>(undefined);

export const SKQueryClientProvider = ({ children }: PropsWithChildren) => {
  const [queryClient] = useState(getQueryClient);

  return (
    <Context.Provider value={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Context.Provider>
  );
};

export const useSKQueryClient = () => {
  const queryClient = useContext(Context);

  if (!queryClient) {
    throw new Error(
      "useSKQueryClient must be used within a QueryClientContextProvider"
    );
  }

  return queryClient;
};
