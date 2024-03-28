import { QueryClient } from "@tanstack/react-query";
import { PropsWithChildren, createContext, useContext, useState } from "react";
import { getQueryClient } from "../../services/query-client";
import { QueryClientProvider } from "@tanstack/react-query";

const Context = createContext<QueryClient | undefined>(undefined);

export const SKQueryClientProvider = ({ children }: PropsWithChildren) => {
  const [queryClient] = useState(() => getQueryClient());

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
