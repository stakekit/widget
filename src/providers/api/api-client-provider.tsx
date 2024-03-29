import axios, { AxiosInstance } from "axios";
import { PropsWithChildren, createContext, useContext, useState } from "react";
import { useSettings } from "../settings";
import { ApiClientProvider } from "@stakekit/api-hooks";
import { attachDelayInterceptor } from "../../common/delay-api-requests";
import { attachGeoBlockInterceptor } from "../../hooks/use-geo-block";
import { attachRichErrorsInterceptor } from "../../hooks/use-rich-errors";
import { useTranslation } from "react-i18next";
import { config } from "../../config";

const Context = createContext<AxiosInstance | undefined>(undefined);

export const SKApiClientProvider = ({ children }: PropsWithChildren) => {
  const { apiKey } = useSettings();
  const { i18n } = useTranslation();

  const [apiClient] = useState(() => {
    const instance = axios.create({
      baseURL: config.env.apiUrl,
      headers: { "X-API-KEY": apiKey },
    });

    attachDelayInterceptor(instance);
    attachGeoBlockInterceptor(instance);
    attachRichErrorsInterceptor(instance, i18n);

    return instance;
  });

  return (
    <Context.Provider value={apiClient}>
      <ApiClientProvider apiClient={apiClient}>{children}</ApiClientProvider>
    </Context.Provider>
  );
};

export const useApiClient = () => {
  const value = useContext(Context);

  if (!value) {
    throw new Error("ApiClient must be used within a ApiHooksProvider");
  }

  return value;
};
