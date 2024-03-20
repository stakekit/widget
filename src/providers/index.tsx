import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ComponentProps, PropsWithChildren, StrictMode } from "react";
import { StakeKitQueryProvider } from "@stakekit/api-hooks";
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
import { SKQueryClientContextProvider } from "./query-client";

export const Providers = ({
  children,
}: PropsWithChildren & ComponentProps<typeof WagmiConfigProvider>) => {
  const { tracking, showQueryDevtools } = useSettings();

  return (
    <StrictMode>
      <StakeKitQueryProvider>
        <SKQueryClientContextProvider>
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
                                  <SKLocationProvider>
                                    <MountAnimationProvider>
                                      {children}
                                    </MountAnimationProvider>
                                  </SKLocationProvider>
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
        </SKQueryClientContextProvider>
      </StakeKitQueryProvider>
    </StrictMode>
  );
};
