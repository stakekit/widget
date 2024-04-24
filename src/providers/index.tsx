import type { ComponentProps, PropsWithChildren } from "react";
import { StrictMode } from "react";
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
import { RootElementProvider } from "./root-element";
import { DisableTransitionDurationProvider } from "../navigation/containers/animation-layout";

export const Providers = ({
  children,
}: PropsWithChildren & ComponentProps<typeof WagmiConfigProvider>) => {
  const { tracking } = useSettings();

  return (
    <StrictMode>
      <RootElementProvider>
        <SKApiClientProvider>
          <SKQueryClientProvider>
            <SKLocationProvider>
              <MountAnimationProvider>
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
                                          <DisableTransitionDurationProvider>
                                            {children}
                                          </DisableTransitionDurationProvider>
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
              </MountAnimationProvider>
            </SKLocationProvider>
          </SKQueryClientProvider>
        </SKApiClientProvider>
      </RootElementProvider>
    </StrictMode>
  );
};
