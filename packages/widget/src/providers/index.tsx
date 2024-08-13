import { EarnPageStateProvider } from "@sk-widget/pages/details/earn-page/state/earn-page-state-context";
import { EnterStakeProvider } from "@sk-widget/providers/enter-stake-state";
import { ExitStakeProvider } from "@sk-widget/providers/exit-stake-state";
import { PendingActionProvider } from "@sk-widget/providers/pending-action-state";
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
                          <EarnPageStateProvider>
                            <ActionHistoryContextProvider>
                              <ThemeWrapper>
                                <ListStateContextProvider>
                                  <CurrentLayoutProvider>
                                    <HeaderHeightProvider>
                                      <FooterHeightProvider>
                                        <FooterButtonProvider>
                                          <PoweredByHeightProvider>
                                            <DisableTransitionDurationProvider>
                                              <EnterStakeProvider>
                                                <ExitStakeProvider>
                                                  <PendingActionProvider>
                                                    {children}
                                                  </PendingActionProvider>
                                                </ExitStakeProvider>
                                              </EnterStakeProvider>
                                            </DisableTransitionDurationProvider>
                                          </PoweredByHeightProvider>
                                        </FooterButtonProvider>
                                      </FooterHeightProvider>
                                    </HeaderHeightProvider>
                                  </CurrentLayoutProvider>
                                </ListStateContextProvider>
                              </ThemeWrapper>
                            </ActionHistoryContextProvider>
                          </EarnPageStateProvider>
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
