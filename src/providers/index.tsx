import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ComponentProps, PropsWithChildren, StrictMode } from "react";
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
import { ActionHistoryContextProvider } from "./stake-history";
import { ListStateContextProvider } from "./list-state";

export const Providers = ({
  children,
}: PropsWithChildren & ComponentProps<typeof WagmiProvider>) => {
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
                  <StakeStateProvider>
                    <ThemeWrapper>
                      <LocationTransitionProvider>
                        <ActionHistoryContextProvider>
                          <ListStateContextProvider>
                            {children}
                          </ListStateContextProvider>
                        </ActionHistoryContextProvider>
                      </LocationTransitionProvider>
                    </ThemeWrapper>
                  </StakeStateProvider>
                </RainbowProvider>
              </SKWalletProvider>
            </TrackingContextProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </StakeKitQueryProvider>
    </StrictMode>
  );
};
