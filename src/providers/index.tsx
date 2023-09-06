import { QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";
import { queryClient } from "../services/query-client";
import { APIManager, StakeKitQueryProvider } from "@stakekit/api-hooks";
import { EVMProvider } from "./ethereum/provider";
import { ThemeWrapper } from "./theme-wrapper";
import { LocationTransitionProvider } from "./location-transition";
import { StakeStateProvider } from "../state/stake";
import { useSettings } from "./settings";

export const Providers = ({ children }: PropsWithChildren) => {
  APIManager.setApiKey(useSettings().apiKey);

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
