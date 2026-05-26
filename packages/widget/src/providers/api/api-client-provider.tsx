import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useMemo } from "react";
import { config } from "../../config";
import { useSettings } from "../settings";
import { type ApiClient, createApiClient } from "./api-client";

const Context = createContext<ApiClient | undefined>(undefined);

export const SKApiClientProvider = ({ children }: PropsWithChildren) => {
  const { apiKey, baseUrl, yieldsApiUrl } = useSettings();

  const apiClient = useMemo(
    () =>
      createApiClient({
        apiKey,
        baseUrl: baseUrl ?? config.env.apiUrl,
        yieldsApiUrl: yieldsApiUrl ?? config.env.yieldsApiUrl,
      }),
    [apiKey, baseUrl, yieldsApiUrl]
  );

  useEffect(() => () => void apiClient.dispose(), [apiClient]);

  return <Context.Provider value={apiClient}>{children}</Context.Provider>;
};

export const useApiClient = () => {
  const value = useContext(Context);

  if (!value) {
    throw new Error("useApiClient must be used within a SKApiClientProvider");
  }

  return value;
};
