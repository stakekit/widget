import { EarnPageStateProvider } from "@sk-widget/pages/details/earn-page/state/earn-page-state-context";
import { ActivityProvider } from "@sk-widget/providers/activity-provider";
import { EnterStakeStoreProvider } from "@sk-widget/providers/enter-stake-store";
import { ExitStakeStoreProvider } from "@sk-widget/providers/exit-stake-store";
import { PendingActionStoreProvider } from "@sk-widget/providers/pending-action-store";
import { i18nInstance } from "@sk-widget/translation";
import type { ComponentProps, PropsWithChildren } from "react";
import { StrictMode } from "react";
import { I18nextProvider } from "react-i18next";
import { HeaderHeightProvider } from "../components/molecules/header/use-sync-header-height";
import { DisableTransitionDurationProvider } from "../navigation/containers/animation-layout";
import {
  FooterButtonProvider,
  FooterHeightProvider,
} from "../pages/components/footer-outlet/context";
import { CurrentLayoutProvider } from "../pages/components/layout/layout-context";
import { PoweredByHeightProvider } from "../pages/components/powered-by";
import { SKApiClientProvider } from "./api/api-client-provider";
import { ListStateContextProvider } from "./list-state";
import { SKLocationProvider } from "./location";
import { MountAnimationProvider } from "./mount-animation";
import { SKQueryClientProvider } from "./query-client";
import { RainbowProvider } from "./rainbow";
import { RootElementProvider } from "./root-element";
import { SKWalletProvider } from "./sk-wallet";
import { ActionHistoryContextProvider } from "./stake-history";
import { ThemeWrapper } from "./theme-wrapper";
import { TrackingContextProviderWithProps } from "./tracking";
import { WagmiConfigProvider } from "./wagmi/provider";

export const Providers = ({
  children,
}: PropsWithChildren & ComponentProps<typeof WagmiConfigProvider>) => {
  return (
    <StrictMode>
      <RootElementProvider>
        <I18nextProvider i18n={i18nInstance}>
          <SKApiClientProvider>
            <SKQueryClientProvider>
              <SKLocationProvider>
                <MountAnimationProvider>
                  <WagmiConfigProvider>
                    <TrackingContextProviderWithProps>
                      <SKWalletProvider>
                        <RainbowProvider>
                          <ActionHistoryContextProvider>
                            <EarnPageStateProvider>
                              <ThemeWrapper>
                                <ListStateContextProvider>
                                  <CurrentLayoutProvider>
                                    <HeaderHeightProvider>
                                      <FooterHeightProvider>
                                        <FooterButtonProvider>
                                          <PoweredByHeightProvider>
                                            <DisableTransitionDurationProvider>
                                              <EnterStakeStoreProvider>
                                                <ExitStakeStoreProvider>
                                                  <PendingActionStoreProvider>
                                                    <ActivityProvider>
                                                      {children}
                                                    </ActivityProvider>
                                                  </PendingActionStoreProvider>
                                                </ExitStakeStoreProvider>
                                              </EnterStakeStoreProvider>
                                            </DisableTransitionDurationProvider>
                                          </PoweredByHeightProvider>
                                        </FooterButtonProvider>
                                      </FooterHeightProvider>
                                    </HeaderHeightProvider>
                                  </CurrentLayoutProvider>
                                </ListStateContextProvider>
                              </ThemeWrapper>
                            </EarnPageStateProvider>
                          </ActionHistoryContextProvider>
                        </RainbowProvider>
                      </SKWalletProvider>
                    </TrackingContextProviderWithProps>
                  </WagmiConfigProvider>
                </MountAnimationProvider>
              </SKLocationProvider>
            </SKQueryClientProvider>
          </SKApiClientProvider>
        </I18nextProvider>
      </RootElementProvider>
    </StrictMode>
  );
};
