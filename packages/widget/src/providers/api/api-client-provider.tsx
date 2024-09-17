import { attachMaintenanceInterceptor } from "@sk-widget/hooks/use-under-maintenance";
import { ApiClientProvider } from "@stakekit/api-hooks";
import type { AxiosInstance } from "axios";
import axios from "axios";
import type { ComponentProps, PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useState } from "react";
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
      adapter: "fetch",
    });

    attachDelayInterceptor(instance);
    attachGeoBlockInterceptor(instance);
    attachRichErrorsInterceptor(instance, i18n);
    attachMaintenanceInterceptor(instance);

    return instance;
  });

  const fetchInstance = useCallback<
    ComponentProps<typeof ApiClientProvider>["fetchInstance"]
  >(
    (url, requestInit) =>
      apiClient(url, requestInit).then((response) => response.data),
    [apiClient]
  );

  return (
    <Context.Provider value={apiClient}>
      <ApiClientProvider
        apiKey={apiKey}
        baseURL={config.env.apiUrl}
        fetchInstance={fetchInstance}
      >
        {children}
      </ApiClientProvider>
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
