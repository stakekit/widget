import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ComponentProps, PropsWithChildren, StrictMode } from "react";
import { queryClient } from "../services/query-client";
import { APIManager, StakeKitQueryProvider } from "@stakekit/api-hooks";
import { ThemeWrapper } from "./theme-wrapper";
import { StakeStateProvider } from "../state/stake";
import { useSettings } from "./settings";
import { WagmiProvider } from "./wagmi/provider";
import { SKWalletProvider } from "./sk-wallet";
import { RainbowProvider } from "./rainbow";
import { TrackingContextProvider } from "./tracking";
import { ActionHistoryContextProvider } from "./stake-history";
import { ListStateContextProvider } from "./list-state";
import { CurrentLayoutProvider } from "../pages/components/layout/layout-context";
import { HeaderHeightProvider } from "../components/molecules/header/use-sync-header-height";
import { MountAnimationFinishedProvider } from "../navigation/containers/animation-layout";
import { SKLocationProvider } from "./location";
import {
  FooterButtonProvider,
  FooterHeightProvider,
} from "../pages/components/footer-outlet/context";

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
                  <ActionHistoryContextProvider>
                    <StakeStateProvider>
                      <ThemeWrapper>
                        <ListStateContextProvider>
                          <CurrentLayoutProvider>
                            <HeaderHeightProvider>
                              <FooterHeightProvider>
                                <MountAnimationFinishedProvider>
                                  <FooterButtonProvider>
                                    <SKLocationProvider>
                                      {children}
                                    </SKLocationProvider>
                                  </FooterButtonProvider>
                                </MountAnimationFinishedProvider>
                              </FooterHeightProvider>
                            </HeaderHeightProvider>
                          </CurrentLayoutProvider>
                        </ListStateContextProvider>
                      </ThemeWrapper>
                    </StakeStateProvider>
                  </ActionHistoryContextProvider>
                </RainbowProvider>
              </SKWalletProvider>
            </TrackingContextProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </StakeKitQueryProvider>
    </StrictMode>
  );
};
