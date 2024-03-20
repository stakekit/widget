import { QueryClient } from "@tanstack/react-query";
import { PropsWithChildren, createContext, useContext, useState } from "react";
import { getQueryClient } from "../../services/query-client";
import { QueryClientProvider } from "@tanstack/react-query";

const QueryClientContext = createContext<QueryClient | undefined>(undefined);

export const SKQueryClientContextProvider = ({
  children,
}: PropsWithChildren) => {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientContext.Provider value={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </QueryClientContext.Provider>
  );
};

export const useSKQueryClient = () => {
  const queryClient = useContext(QueryClientContext);

  if (!queryClient) {
    throw new Error(
      "useSKQueryClient must be used within a QueryClientContextProvider"
    );
  }

  return queryClient;
};
