import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ComponentProps, PropsWithChildren, StrictMode } from "react";
import { ThemeWrapper } from "./theme-wrapper";
import { StakeStateProvider } from "../state/stake";
import { useSettings } from "./settings";
import { WagmiConfigProvider } from "./wagmi/provider";
import { SKWalletProvider } from "./sk-wallet";
import { RainbowProvider } from "./rainbow";
import { TrackingContextProvider } from "./tracking";
import { ActionHistoryContextProvider } from "./stake-history";
import { ListStateContextProvider } from "./list-state";
import { CurrentLayoutProvider } from "../pages/components/layout/layout-context";
import { HeaderHeightProvider } from "../components/molecules/header/use-sync-header-height";
import { SKLocationProvider } from "./location";
import {
  FooterButtonProvider,
  FooterHeightProvider,
} from "../pages/components/footer-outlet/context";
import { MountAnimationProvider } from "./mount-animation";
import { SKQueryClientProvider } from "./query-client";
import { SKApiClientProvider } from "./api/api-client-provider";
import { PoweredByHeightProvider } from "../pages/components/powered-by";

export const Providers = ({
  children,
}: PropsWithChildren & ComponentProps<typeof WagmiConfigProvider>) => {
  const { tracking, showQueryDevtools } = useSettings();

  return (
    <StrictMode>
      <SKApiClientProvider>
        <SKQueryClientProvider>
          {showQueryDevtools && <ReactQueryDevtools initialIsOpen={false} />}

          <WagmiConfigProvider>
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
                                <FooterButtonProvider>
                                  <PoweredByHeightProvider>
                                    <SKLocationProvider>
                                      <MountAnimationProvider>
                                        {children}
                                      </MountAnimationProvider>
                                    </SKLocationProvider>
                                  </PoweredByHeightProvider>
                                </FooterButtonProvider>
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
          </WagmiConfigProvider>
        </SKQueryClientProvider>
      </SKApiClientProvider>
    </StrictMode>
  );
};
