import { QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, StrictMode, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import {
  defaultQueryClientConfiguration,
  queryClient,
} from "../services/query-client";
import { APIManager, StakeKitQueryProvider } from "@stakekit/api-hooks";
import { config } from "../config";
import { EVMProvider } from "./ethereum/provider";
import { ThemeWrapper } from "./theme-wrapper";
import { useSettings } from "./settings";
import { LocationTransitionProvider } from "./location-transition";
import { StakeStateProvider } from "../state/stake";

export const Providers = ({ children }: PropsWithChildren) => {
  const { apiKey } = useSettings();

  useState(() =>
    APIManager.configure({
      apiKey: apiKey,
      baseURL: config.apiUrl,
      queryClientConfig: {
        defaultOptions: defaultQueryClientConfiguration as any,
      },
    })
  );

  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <StakeKitQueryProvider>
          <EVMProvider>
            <MemoryRouter>
              <StakeStateProvider>
                <ThemeWrapper>
                  <LocationTransitionProvider>
                    {children}
                  </LocationTransitionProvider>
                </ThemeWrapper>
              </StakeStateProvider>
            </MemoryRouter>
          </EVMProvider>
        </StakeKitQueryProvider>
      </QueryClientProvider>
    </StrictMode>
  );
};
