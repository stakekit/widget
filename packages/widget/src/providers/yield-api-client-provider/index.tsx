import type { i18n } from "i18next";
import createFetchClient from "openapi-fetch";
import type { OpenapiQueryClient } from "openapi-react-query";
import createClient from "openapi-react-query";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { waitForDelayedApiRequests } from "../../common/delay-api-requests";
import { config } from "../../config";
import type { YieldApiFetchClient } from "../../domain/types/yield-api";
import { handleGeoBlockResponse } from "../../hooks/use-geo-block";
import { handleRichErrorResponse } from "../../hooks/use-rich-errors";
import type { paths } from "../../types/yield-api-schema";
import { useSettings } from "../settings";

const QueryContext = createContext<OpenapiQueryClient<paths> | undefined>(
  undefined,
);
const FetchContext = createContext<YieldApiFetchClient | undefined>(undefined);

export const createYieldApiFetchClient = ({
  apiKey,
  i18n,
  url,
}: {
  apiKey: string;
  i18n?: i18n;
  url: string;
}) => {
  const client = createFetchClient<paths>({
    baseUrl: url,
    headers: {
      "x-api-key": apiKey,
    },
  });

  client.use({
    onResponse: async ({ request, response }) => {
      await waitForDelayedApiRequests();

      if (!response.ok) {
        const data = await readYieldErrorResponse(response);

        handleGeoBlockResponse({
          data,
          status: response.status,
        });

        if (i18n) {
          handleRichErrorResponse({
            data,
            i18n,
            url: request.url,
          });
        }
      }

      return response;
    },
  });

  return client;
};

const readYieldErrorResponse = async (response: Response) => {
  const text = await response.clone().text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const YieldApiClientProvider = ({ children }: PropsWithChildren) => {
  const { apiKey, yieldsApiUrl } = useSettings();
  const { i18n } = useTranslation();
  const url = yieldsApiUrl ?? config.env.yieldsApiUrl;

  const clients = useMemo(() => {
    const fetchClient = createYieldApiFetchClient({ apiKey, i18n, url });

    return {
      fetchClient,
      queryClient: createClient(fetchClient),
    };
  }, [apiKey, i18n, url]);

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
      "useYieldApiClient must be used within a YieldApiClientProvider",
    );
  }

  return value;
};

export const useYieldApiFetchClient = () => {
  const value = useContext(FetchContext);

  if (!value) {
    throw new Error(
      "useYieldApiFetchClient must be used within a YieldApiClientProvider",
    );
  }

  return value;
};
