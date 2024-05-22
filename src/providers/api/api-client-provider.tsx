import { ApiClientProvider } from "@stakekit/api-hooks";
import type { AxiosInstance } from "axios";
import axios from "axios";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { attachDelayInterceptor } from "../../common/delay-api-requests";
import { config } from "../../config";
import { attachGeoBlockInterceptor } from "../../hooks/use-geo-block";
import { attachRichErrorsInterceptor } from "../../hooks/use-rich-errors";
import { useSettings } from "../settings";

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
