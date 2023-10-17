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

export const Providers = ({ children }: PropsWithChildren) => {
  APIManager.setApiKey(useSettings().apiKey);

  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <StakeKitQueryProvider>
          <WagmiProvider>
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
          </WagmiProvider>
        </StakeKitQueryProvider>
      </QueryClientProvider>
    </StrictMode>
  );
};
