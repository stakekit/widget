import { QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, StrictMode } from "react";
import { MemoryRouter } from "react-router-dom";
import { queryClient } from "../services/query-client";
import { APIManager, StakeKitQueryProvider } from "@stakekit/api-hooks";
import { ThemeWrapper } from "./theme-wrapper";
import { LocationTransitionProvider } from "./location-transition";
import { StakeStateProvider } from "../state/stake";
import { useSettings } from "./settings";
import { WagmiProvider } from "./wagmi/provider";
import { SKWalletProvider } from "./sk-wallet";
import { RainbowProvider } from "./rainbow";
import { TrackingContextProvider } from "./tracking";

export const Providers = ({ children }: PropsWithChildren) => {
  const { apiKey, tracking } = useSettings();

  APIManager.setApiKey(apiKey);

  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <StakeKitQueryProvider>
          <WagmiProvider>
            <TrackingContextProvider tracking={tracking}>
              <SKWalletProvider>
                <RainbowProvider>
                  <MemoryRouter>
                    <StakeStateProvider>
                      <ThemeWrapper>
                        <LocationTransitionProvider>
                          {children}
                        </LocationTransitionProvider>
                      </ThemeWrapper>
                    </StakeStateProvider>
                  </MemoryRouter>
                </RainbowProvider>
              </SKWalletProvider>
            </TrackingContextProvider>
          </WagmiProvider>
        </StakeKitQueryProvider>
      </QueryClientProvider>
    </StrictMode>
  );
};
