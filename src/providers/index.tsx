import { QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, StrictMode, useRef } from "react";
import { MemoryRouter } from "react-router-dom";
import {
  defaultQueryClientConfiguration,
  queryClient,
} from "../services/query-client";
import { APIManager, StakeKitQueryProvider } from "@stakekit/api-hooks";
import { EVMProvider } from "./ethereum/provider";
import { ThemeWrapper } from "./theme-wrapper";
import { LocationTransitionProvider } from "./location-transition";
import { StakeStateProvider } from "../state/stake";
import { useSettings } from "./settings";
import { config } from "../config";
import { createPortal } from "react-dom";
import { HelpModal } from "../components/molecules/help-modal";
import { useGeoBlock } from "../hooks/use-geo-block";

export const Providers = ({ children }: PropsWithChildren) => {
  const { apiKey } = useSettings();

  const apiManagerConfigured = useRef(false);

  if (!apiManagerConfigured.current) {
    APIManager.configure({
      apiKey: apiKey,
      baseURL: config.apiUrl,
      queryClientConfig: {
        defaultOptions: defaultQueryClientConfiguration as any,
      },
    });
    apiManagerConfigured.current = true;
  }

  const geoBlock = useGeoBlock();

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

                    {geoBlock &&
                      createPortal(
                        <HelpModal modal={{ type: "geoBlock", ...geoBlock }} />,
                        document.body
                      )}
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
