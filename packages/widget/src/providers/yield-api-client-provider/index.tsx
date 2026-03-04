import type { Client } from "openapi-fetch";
import createFetchClient from "openapi-fetch";
import type { OpenapiQueryClient } from "openapi-react-query";
import createClient from "openapi-react-query";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo } from "react";
import { config } from "../../config";
import type { paths } from "../../types/yield-api-schema";
import { useSettings } from "../settings";

const QueryContext = createContext<OpenapiQueryClient<paths> | undefined>(
  undefined
);
const FetchContext = createContext<Client<paths> | undefined>(undefined);

export const YieldApiClientProvider = ({ children }: PropsWithChildren) => {
  const { apiKey, yieldsApiUrl } = useSettings();
  const url = yieldsApiUrl ?? config.env.yieldsApiUrl;

  const clients = useMemo(() => {
    const fetchClient = createFetchClient<paths>({
      baseUrl: url,
      headers: {
        "x-api-key": apiKey,
      },
    });

    return {
      fetchClient,
      queryClient: createClient(fetchClient),
    };
  }, [apiKey, url]);

  return (
    <FetchContext.Provider value={clients.fetchClient}>
      <QueryContext.Provider value={clients.queryClient}>
        {children}
      </QueryContext.Provider>
    </FetchContext.Provider>
  );
};

export const useYieldApiClient = () => {
  const value = useContext(QueryContext);

  if (!value) {
    throw new Error(
      "useYieldApiClient must be used within a YieldApiClientProvider"
    );
  }

  return value;
};

export const useYieldApiFetchClient = () => {
  const value = useContext(FetchContext);

  if (!value) {
    throw new Error(
      "useYieldApiFetchClient must be used within a YieldApiClientProvider"
    );
  }

  return value;
};
