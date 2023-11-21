import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
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
import { StakeHistoryContextProvider } from "./stake-history";

export const Providers = ({ children }: PropsWithChildren) => {
  const { apiKey, tracking } = useSettings();

  APIManager.setApiKey(apiKey);

  return (
    <StrictMode>
      <StakeKitQueryProvider>
        <QueryClientProvider client={queryClient}>
          <ReactQueryDevtools initialIsOpen={false} />

          <WagmiProvider>
            <TrackingContextProvider tracking={tracking}>
              <SKWalletProvider>
                <RainbowProvider>
                  <MemoryRouter>
                    <StakeStateProvider>
                      <ThemeWrapper>
                        <LocationTransitionProvider>
                          <StakeHistoryContextProvider>
                            {children}
                          </StakeHistoryContextProvider>
                        </LocationTransitionProvider>
                      </ThemeWrapper>
                    </StakeStateProvider>
                  </MemoryRouter>
                </RainbowProvider>
              </SKWalletProvider>
            </TrackingContextProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </StakeKitQueryProvider>
    </StrictMode>
  );
};
